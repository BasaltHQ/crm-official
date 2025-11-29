"use client";

import * as React from "react";
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFacetedRowModel,
  getFacetedUniqueValues,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import StageProgressBar, { type StageDatum } from "@/components/StageProgressBar";

import { DataTablePagination } from "./data-table-pagination";
import { DataTableToolbar } from "./data-table-toolbar";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

export function ProjectsDataTable<TData, TValue>({
  columns,
  data,
}: DataTableProps<TData, TValue>) {
  const [rowSelection, setRowSelection] = React.useState({});
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  );
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [projectPools, setProjectPools] = React.useState<Record<string, { poolId: string; name: string; stageData: StageDatum[]; total: number }[]>>({});

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFacetedRowModel: getFacetedRowModel(),
    getFacetedUniqueValues: getFacetedUniqueValues(),
  });

  async function toggleExpand(projectId: string) {
    setExpanded((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
    // Lazy-load pools data when expanding for the first time
    if (!projectPools[projectId]) {
      try {
        const res = await fetch("/api/leads/pools", { cache: "no-store" as any });
        const j = await res.json().catch(() => null);
        const pools: any[] = Array.isArray(j?.pools) ? j.pools : [];
        const assigned = pools.filter((p) => (p?.icpConfig?.assignedProjectId === projectId));
        const stageKeys = ["Identify","Engage_AI","Engage_Human","Offering","Finalizing","Closed"] as const;
        const items: { poolId: string; name: string; stageData: StageDatum[]; total: number }[] = [];
        for (const p of assigned) {
          try {
            const rl = await fetch(`/api/leads/pools/${encodeURIComponent(p.id)}/leads?mine=true`, { cache: "no-store" as any });
            const jl = await rl.json().catch(() => null);
            const leads: any[] = Array.isArray(jl?.leads) ? jl.leads : [];
            const counts: Record<string, number> = {};
            for (const k of stageKeys) counts[k] = 0;
            for (const l of leads) {
              const s = ((l as any).pipeline_stage as string) || "Identify";
              counts[s] = (counts[s] || 0) + 1;
            }
            const stageData: StageDatum[] = stageKeys.map((k) => ({ key: k, label: (k as string).replace("_"," "), count: counts[k] || 0 }));
            items.push({ poolId: p.id, name: p.name, stageData, total: leads.length || 1 });
          } catch {}
        }
        setProjectPools((prev) => ({ ...prev, [projectId]: items }));
      } catch {}
    }
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar table={table} />
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  return (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => {
                const orig: any = row.original as any;
                const projectId = orig?.id as string;
                const pools = projectPools[projectId] || [];
                // Overall stage aggregation
                const agg: Record<string, number> = {};
                const keys = ["Identify","Engage_AI","Engage_Human","Offering","Finalizing","Closed"] as const;
                for (const k of keys) agg[k] = 0;
                let total = 0;
                for (const item of pools) {
                  total += item.total;
                  for (const sd of item.stageData) {
                    agg[sd.key as any] = (agg[sd.key as any] || 0) + (sd.count || 0);
                  }
                }
                const overall: StageDatum[] = keys.map((k) => ({ key: k as any, label: (k as string).replace("_"," "), count: agg[k] || 0 }));

                return (
                  <React.Fragment key={row.id}>
                    <TableRow
                      data-state={row.getIsSelected() && "selected"}
                      onClick={() => toggleExpand(projectId)}
                      className="cursor-pointer"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                    {expanded[projectId] && (
                      <TableRow>
                        <TableCell colSpan={row.getVisibleCells().length}>
                          <div className="space-y-4 p-3 bg-muted/30 rounded">
                            <div>
                              <div className="text-xs text-muted-foreground mb-1">Overall Progress</div>
                              <StageProgressBar stages={overall} total={Math.max(total, 1)} orientation="horizontal" nodeSize={14} trackHeight={12} showMetadata={true} />
                            </div>
                            <div className="space-y-2">
                              {pools.map((p) => (
                                <div key={p.poolId} className="space-y-1">
                                  <div className="text-xs font-medium">{p.name}</div>
                                  <StageProgressBar stages={p.stageData} total={p.total} orientation="horizontal" nodeSize={12} trackHeight={10} showMetadata={true} />
                                </div>
                              ))}
                              {pools.length === 0 && (
                                <div className="text-xs text-muted-foreground">No lead pools assigned to this project.</div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <DataTablePagination table={table} />
    </div>
  );
}
