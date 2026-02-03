import { prismadb } from "@/lib/prisma";
import { Team } from "@prisma/client";
import { getCurrentUserTeamId } from "@/lib/team-utils";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

//Get all users for admin module (Scoped to Team)
export const getUsers = async () => {
  const session = await getServerSession(authOptions);
  const teamInfo = await getCurrentUserTeamId();
  const teamId = teamInfo?.teamId;

  if (!teamId) return [];

  // Fetch users without the invalid defined relation
  const data = await (prismadb.users as any).findMany({
    where: {
      OR: [
        { team_id: teamId },
        { assigned_team: { parent_id: teamId } }
      ]
    },
    include: {
      assigned_team: true
    },
    orderBy: {
      created_on: "desc",
    },
  });

  // Extract all department IDs
  const departmentIds = data
    .map((user: any) => user.department_id)
    .filter((id: any) => id); // Filter out null/undefined

  // Fetch departments if there are any
  let departments: Team[] = [];
  if (departmentIds.length > 0) {
    departments = await prismadb.team.findMany({
      where: {
        id: { in: departmentIds },
        // @ts-ignore - Resolving IDE sync issue, field exists in generated client
        team_type: 'DEPARTMENT'
      }
    });
  }

  // Create a map for quick lookup
  const deptMap = new Map(departments.map((d: any) => [d.id, d]));

  // Attach assigned_department to users
  const enrichedData = data.map((user: any) => {
    const copy = { ...user };
    if (user.department_id && deptMap.has(user.department_id)) {
      copy.assigned_department = deptMap.get(user.department_id);
    } else {
      copy.assigned_department = null;
    }
    return copy;
  });

  return enrichedData;
};

//Get active users for Selects in app etc
export const getActiveUsers = async () => {
  const data = await prismadb.users.findMany({
    orderBy: {
      created_on: "desc",
    },
    where: {
      userStatus: "ACTIVE",
    },
  });
  return data;
};

//Get new users by month for chart
export const getUsersByMonthAndYear = async (year: number) => {
  const users = await prismadb.users.findMany({
    select: {
      created_on: true,
    },
  });

  if (!users) {
    return {};
  }

  const usersByMonth = users.reduce((acc: any, user: any) => {
    const yearCreated = new Date(user.created_on).getFullYear();
    const month = new Date(user.created_on).toLocaleString("default", {
      month: "long",
    });

    if (yearCreated === year) {
      acc[month] = (acc[month] || 0) + 1;
    }

    return acc;
  }, {});

  const chartData = Object.keys(usersByMonth).map((month: any) => {
    return {
      name: month,
      Number: usersByMonth[month],
    };
  });

  return chartData;
};

//Get new users by month for chart
export const getUsersByMonth = async () => {
  const users = await prismadb.users.findMany({
    select: {
      created_on: true,
    },
  });

  if (!users) {
    return {};
  }

  const usersByMonth = users.reduce((acc: any, user: any) => {
    const month = new Date(user.created_on).toLocaleString("default", {
      month: "long",
    });

    acc[month] = (acc[month] || 0) + 1;

    return acc;
  }, {});

  const chartData = Object.keys(usersByMonth).map((month: any) => {
    return {
      name: month,
      Number: usersByMonth[month],
    };
  });

  return chartData;
};

export const getUsersCountOverall = async () => {
  const users = await prismadb.users.findMany({
    select: {
      created_on: true,
    },
  });

  if (!users) {
    return {};
  }

  const usersByMonth = users.reduce((acc: any, user: any) => {
    const date = new Date(user.created_on);
    const yearMonth = `${date.getFullYear()}-${date.getMonth() + 1}`;

    acc[yearMonth] = (acc[yearMonth] || 0) + 1;

    return acc;
  }, {});

  const chartData = Object.keys(usersByMonth).map((yearMonth: any) => {
    const [year, month] = yearMonth.split("-");
    return {
      year: parseInt(year),
      month: parseInt(month),
      name: `${month}/${year}`,
      Number: usersByMonth[yearMonth],
    };
  });

  return chartData;
};
