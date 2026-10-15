// @ts-nocheck
"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { MoreHorizontal, Shield, User, Trash, Search, Plus, KeyRound, Ban, CheckCircle, Fingerprint, UserPlus, Building2, Layers, AlertCircle } from "lucide-react";
import { UserModulesModal } from "./UserModulesModal";
import { AssignDepartmentModal } from "./AssignDepartmentModal";
import { useSignedUrl } from "@/hooks/use-signed-url";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";

import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { updateMemberRole, removeMember, searchUsers, addMember, changePassword, toggleUserStatus, setTeamOwner } from "@/actions/teams/member-actions";
import { TeamChangeRoleModal, RoleOption } from "./TeamChangeRoleModal";

// Define base roles available to all teams
const BASE_ROLES: RoleOption[] = [
    {
        value: "ADMIN",
        label: "Admin",
        description: "Full access to manage company settings and members.",
        icon: Shield,
    },
    {
        value: "MEMBER",
        label: "Member",
        description: "Can access standard features and modules.",
        icon: User,
    },
];

// Define Platform Admin role
const PLATFORM_ADMIN_ROLE: RoleOption = {
    value: "PLATFORM_ADMIN",
    label: "Platform Admin",
    description: "Full control over the entire platform (Super Admin).",
    icon: Shield,
};

/** Resolves private S3/OVH avatar URLs via signed URL hook. */
function SignedAvatarImage({ src, ...props }: { src?: string | null } & React.ComponentPropsWithoutRef<typeof AvatarImage>) {
    const { signedUrl } = useSignedUrl(src);
    return <AvatarImage {...props} src={signedUrl || undefined} />;
}


type Member = {
    id: string;
    name: string | null;
    email: string;
    avatar: string | null;
    team_role: string | null;
};

type Props = {
    teamId: string;
    teamSlug: string;
    members: Member[];
    isSuperAdmin?: boolean;
    isGlobalAdmin?: boolean;
    ownerId?: string | null;
    hasDepartments?: boolean;
    departmentMap?: Record<string, string>;
    isExemptTeam?: boolean;
    maxSeats?: number;
};

const TeamMembersTable = ({ teamId, teamSlug, members, isSuperAdmin, isGlobalAdmin, ownerId, hasDepartments = false, departmentMap = {}, isExemptTeam = false, maxSeats = -1 }: Props) => {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [addOpen, setAddOpen] = useState(false);

    // Role Change State
    const [roleModalOpen, setRoleModalOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);

    // Invite New Member State
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("MEMBER");
    const [inviteLoading, setInviteLoading] = useState(false);

    // Module & Department Assignment State
    const [moduleMember, setModuleMember] = useState<Member | null>(null);
    const [deptMember, setDeptMember] = useState<Member | null>(null);

    const canInvite = ["ADMIN", "OWNER", "PLATFORM_ADMIN", "SUPER_ADMIN", "PLATFORM ADMIN"].includes((members as any)?._currentUserRole || "") || isSuperAdmin || isGlobalAdmin;

    const handleInvite = async () => {
        if (!inviteName || !inviteEmail) return;
        try {
            setInviteLoading(true);
            const res = await fetch("/api/user/inviteuser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: inviteName,
                    email: inviteEmail,
                    language: "en",
                    role: inviteRole,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to invite user");
            } else {
                toast.success(`Invitation sent to ${inviteEmail}`);
                setInviteOpen(false);
                setInviteName("");
                setInviteEmail("");
                setInviteRole("MEMBER");
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to send invitation");
        } finally {
            setInviteLoading(false);
        }
    };

    // Password Reset State
    const [passwordOpen, setPasswordOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<string | null>(null);
    const [newPassword, setNewPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const handlePasswordChange = async () => {
        if (!selectedUser || !newPassword) return;
        try {
            setIsLoading(true);
            const res = await changePassword(selectedUser, newPassword);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Password updated successfully");
                setPasswordOpen(false);
                setNewPassword("");
                setSelectedUser(null);
            }
        } catch (error) {
            toast.error("Failed to update password");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSetOwner = async (userId: string) => {
        if (!confirm("Are you sure? This will transfer primary ownership to this user.")) return;
        try {
            setIsLoading(true);
            const res = await setTeamOwner(teamId, userId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Team ownership updated successfully");
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to set team owner");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleStatus = async (userId: string, currentStatus: string | null) => {
        const newStatus = currentStatus === "INACTIVE" ? "ACTIVE" : "INACTIVE";
        try {
            setIsLoading(true);
            const res = await toggleUserStatus(userId, newStatus);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success(`User ${newStatus === "ACTIVE" ? "Enabled" : "Disabled"}`);
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to update status");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRoleUpdate = async (userId: string, role: string) => {
        try {
            // setIsLoading(true); // Handled by modal
            const res = await updateMemberRole(userId, role);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Role updated");
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to update");
        }
    };

    const handleRemove = async (userId: string) => {
        if (!confirm("Are you sure? This will remove the user from the company.")) return;
        try {
            setIsLoading(true);
            const res = await removeMember(userId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Member removed");
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to remove");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSearch = async (val: string) => {
        setSearchQuery(val);
        if (val.length > 2) {
            setSearchLoading(true);
            const users = await searchUsers(val);
            setSearchResults(users);
            setSearchLoading(false);
        } else {
            setSearchResults([]);
        }
    };

    const handleAdd = async (userId: string) => {
        try {
            const res = await addMember(teamId, userId);
            if (res.error) {
                toast.error(res.error);
            } else {
                toast.success("Member added!");
                setAddOpen(false);
                setSearchQuery("");
                setSearchResults([]);
                router.refresh();
            }
        } catch (error) {
            toast.error("Failed to add");
        }
    }


    const isOverLimit = maxSeats !== -1 && members.length > maxSeats;

    return (
        <Card>
            {isOverLimit && (
                <div className="bg-red-500/10 border-l-4 border-red-500 p-4 m-4 rounded-md flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                    <div>
                        <h4 className="font-bold text-red-500">Seat Limit Exceeded</h4>
                        <p className="text-sm text-red-500/80">
                            Your workspace has {members.length} users but your subscription only covers {maxSeats} seats. 
                            Please use the table below to disable or remove users, or upgrade your active seat quantity to avoid account suspension.
                        </p>
                    </div>
                </div>
            )}
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">{isExemptTeam ? "Platform Admins" : "Personnel"}</CardTitle>
                    <CardDescription>
                        {isExemptTeam ? "Users with platform-level administrative access. Full team management is in the Admin module." : "Manage company personnel."}
                    </CardDescription>
                </div>

                {!isExemptTeam && (
                <div className="flex items-center gap-2">
                    <Dialog open={addOpen} onOpenChange={setAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm" variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Existing
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">Add Personnel</DialogTitle>
                                <DialogDescription>
                                    Search for existing system users to add to this company.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <Input
                                    placeholder="Search by name or email..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                />

                                <div className="space-y-2 border rounded-md p-2 h-[200px] overflow-y-auto">
                                    {searchLoading && <p className="text-sm text-center py-2">Searching...</p>}
                                    {searchResults.map(user => (
                                        <div key={user.id} className="flex justify-between items-center p-2 hover:bg-muted rounded">
                                            <div className="flex items-center gap-2">
                                                <Avatar className="h-8 w-8">
                                                    <SignedAvatarImage src={user.avatar || undefined} />
                                                    <AvatarFallback>{(user.name?.[0] || "U")}</AvatarFallback>
                                                </Avatar>
                                                <div className="text-sm">
                                                    <p className="font-medium">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                            {user.team_id ? (
                                                <Badge variant="secondary" className="text-xs">In Company</Badge>
                                            ) : (
                                                <Button size="sm" variant="ghost" onClick={() => handleAdd(user.id)}>Add</Button>
                                            )}
                                        </div>
                                    ))}
                                    {searchQuery.length > 2 && searchResults.length === 0 && !searchLoading && (
                                        <p className="text-sm text-center py-4 text-muted-foreground">No users found.</p>
                                    )}
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                        <DialogTrigger asChild>
                            <Button size="sm">
                                <UserPlus className="w-4 h-4 mr-2" />
                                Invite New Member
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">Invite New Member</DialogTitle>
                                <DialogDescription>
                                    Create a new user account and send them an invitation email with their login credentials.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>Full Name</Label>
                                    <Input
                                        placeholder="e.g. John Smith"
                                        value={inviteName}
                                        onChange={(e) => setInviteName(e.target.value)}
                                        disabled={inviteLoading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Email Address</Label>
                                    <Input
                                        type="email"
                                        placeholder="e.g. john@company.com"
                                        value={inviteEmail}
                                        onChange={(e) => setInviteEmail(e.target.value)}
                                        disabled={inviteLoading}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Role</Label>
                                    <Select value={inviteRole} onValueChange={setInviteRole} disabled={inviteLoading}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select role" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ADMIN">Admin — Full access to manage company settings</SelectItem>
                                            <SelectItem value="MEMBER">Member — Standard access to assigned features</SelectItem>
                                            <SelectItem value="VIEWER">Viewer — Read-only access</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    A temporary password will be auto-generated and emailed to the user.
                                </p>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setInviteOpen(false)} disabled={inviteLoading}>Cancel</Button>
                                <Button onClick={handleInvite} disabled={inviteLoading || !inviteName || !inviteEmail}>
                                    {inviteLoading ? "Sending..." : "Send Invitation"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
                )}

            </CardHeader>

            {/* Change Role Modal */}
            {selectedMember && (
                <TeamChangeRoleModal
                    isOpen={roleModalOpen}
                    onClose={() => { setRoleModalOpen(false); setSelectedMember(null); }}
                    memberId={selectedMember.id}
                    memberName={selectedMember.name || "User"}
                    currentRole={selectedMember.team_role || "MEMBER"}
                    onConfirm={handleRoleUpdate}
                    allowedRoles={
                        ["ledger1", "basalthq", "basalt"].includes(teamSlug)
                            ? [PLATFORM_ADMIN_ROLE, ...BASE_ROLES]
                            : BASE_ROLES
                    }
                />
            )}

            <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="text-xl md:text-2xl font-black bg-gradient-to-r from-primary to-primary/50 bg-clip-text text-transparent italic tracking-tight uppercase leading-relaxed py-2 px-2">Change Password</DialogTitle>
                        <DialogDescription>
                            Enter a new password for this user.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4 property-wrapper">
                        <div className="relative">
                            <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="New Password"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="pr-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                onClick={() => setShowPassword((prev) => !prev)}
                                disabled={isLoading}
                            >
                                <Fingerprint className={`h-4 w-4 ${showPassword ? "text-primary" : "text-muted-foreground"}`} />
                            </Button>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPasswordOpen(false)}>Cancel</Button>
                        <Button onClick={handlePasswordChange} disabled={isLoading || !newPassword}>Update Password</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <CardContent>
                <div className="space-y-4">
                    {members.map((member) => {
                        const isOwner = ownerId && member.id === ownerId;
                        return (
                            <div key={member.id} className={`flex items-center justify-between p-4 border rounded-lg ${isOwner ? "bg-amber-500/5 border-amber-500/30" : "bg-card/50"}`}>
                                <div className="flex items-center gap-4">
                                    <Avatar>
                                        <SignedAvatarImage src={member.avatar || undefined} />
                                        <AvatarFallback>{(member.name || member.email)[0].toUpperCase()}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{member.name || "Unknown Name"}</p>
                                            {isOwner && (
                                                <Badge variant="secondary" className="text-xs bg-amber-500/20 text-amber-400 border-amber-500/30">
                                                    Owner
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground">{member.email}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {(() => {
                                        const isExplicitPlatformAdmin = member.team_role === "PLATFORM_ADMIN" || (member as any).is_admin;
                                        const showPlatformAdminBadge = isExplicitPlatformAdmin && ["ledger1", "basalthq", "basalt"].includes(teamSlug);
                                        
                                        const deptName = departmentMap[(member as any).department_id] || departmentMap[(member as any).team_id];
                                        const isCompanyLevel = (member as any).team_id === teamId;
                                        const isDeptAdmin = deptName && !isCompanyLevel && (member.team_role === "ADMIN" || member.team_role === "OWNER");
                                        
                                        // We show the standalone role if they are NOT a dept admin, and NOT an explicit platform admin.
                                        // (Because if they are an explicit platform admin, the red badge covers it).
                                        // Except if they have no role, we still might want to show "MEMBER".
                                        const baseRole = member.team_role || "MEMBER";
                                        const showStandaloneRole = !isDeptAdmin && (!isExplicitPlatformAdmin || !showPlatformAdminBadge);

                                        return (
                                            <>
                                                {showPlatformAdminBadge && (
                                                    <Badge variant="destructive">
                                                        PLATFORM_ADMIN
                                                    </Badge>
                                                )}
                                                
                                                {showStandaloneRole && (
                                                    <Badge variant={baseRole === "OWNER" ? "default" : baseRole === "ADMIN" ? "secondary" : "outline"}>
                                                        {baseRole}
                                                    </Badge>
                                                )}

                                                {deptName && (
                                                    isDeptAdmin ? (
                                                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30">
                                                            <Building2 className="w-3 h-3 mr-1" />
                                                            {deptName} - Admin
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-400 border-blue-500/30">
                                                            <Building2 className="w-3 h-3 mr-1" />
                                                            {deptName}
                                                        </Badge>
                                                    )
                                                )}
                                            </>
                                        );
                                    })()}
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isLoading}>
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                            {/* Unified Change Role Option */}
                                            {/* Hide for OWNER to prevent accidental changes (System-Wide Protection) */}
                                            {member.team_role !== "OWNER" && (
                                                <DropdownMenuItem onClick={() => { setSelectedMember(member); setRoleModalOpen(true); }}>
                                                    <Shield className="w-4 h-4 mr-2" /> Change Role
                                                </DropdownMenuItem>
                                            )}

                                            {/* Set as Team Owner */}
                                            {(isGlobalAdmin || isSuperAdmin) && member.team_role !== "OWNER" && (
                                                <DropdownMenuItem onClick={() => handleSetOwner(member.id)}>
                                                    <Shield className="w-4 h-4 mr-2 text-amber-500" /> Set as Team Owner
                                                </DropdownMenuItem>
                                            )}

                                            {/* Assign to Department */}
                                            <DropdownMenuItem onClick={() => setDeptMember(member)}>
                                                <Building2 className="w-4 h-4 mr-2" /> Assign Department
                                            </DropdownMenuItem>
                                            {/* Configure Modules — only available when no departments are set up */}
                                            {!hasDepartments && (
                                                <DropdownMenuItem onClick={() => setModuleMember(member)}>
                                                    <Layers className="w-4 h-4 mr-2" /> Configure Modules
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem className="text-red-600" onClick={() => handleRemove(member.id)}>
                                                <Trash className="w-4 h-4 mr-2" /> Remove from Company
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuLabel>Admin</DropdownMenuLabel>
                                            <DropdownMenuItem onClick={() => { setSelectedUser(member.id); setPasswordOpen(true); }}>
                                                <KeyRound className="w-4 h-4 mr-2" /> Change Password
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleToggleStatus(member.id, (member as any).userStatus)}>
                                                {(member as any).userStatus === "INACTIVE" ? (
                                                    <><CheckCircle className="w-4 h-4 mr-2 text-green-600" /> Enable Account</>
                                                ) : (
                                                    <><Ban className="w-4 h-4 mr-2 text-red-600" /> Disable Account</>
                                                )}
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </div>
                        );
                    })}

                    {members.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            No personnel in this company yet.
                        </div>
                    )}
                </div>
            </CardContent>

            {/* User Modules Modal — only when no departments */}
            {moduleMember && !hasDepartments && (
                <UserModulesModal
                    isOpen={!!moduleMember}
                    onClose={() => setModuleMember(null)}
                    userId={moduleMember.id}
                    userName={moduleMember.name || moduleMember.email}
                    departmentAllowedModules={[]}
                />
            )}

            {/* Assign Department Modal */}
            {deptMember && (
                <AssignDepartmentModal
                    isOpen={!!deptMember}
                    onClose={() => setDeptMember(null)}
                    userId={deptMember.id}
                    userName={deptMember.name || deptMember.email}
                    teamId={teamId}
                />
            )}
        </Card >
    );
};

export default TeamMembersTable;
