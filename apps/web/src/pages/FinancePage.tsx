import { useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpZA } from "lucide-react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TransactionType = "INCOME" | "EXPENSE"

interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category: string
  description: string | null
  occurredAt: string
  createdAt: string
  updatedAt: string
}

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
})

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

export function FinancePage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "occurredAt", desc: true },
  ])

  useEffect(() => {
    api
      .get<Transaction[]>("/transactions")
      .then((res) => setTransactions(res.data))
      .catch(() => toast.error("Erro ao carregar transações"))
      .finally(() => setLoading(false))
  }, [])

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="h-8 px-2"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Data
            {column.getIsSorted() === "asc" ? (
              <ArrowDownAZ className="ml-2 h-3.5 w-3.5" />
            ) : (
              <ArrowUpZA className="ml-2 h-3.5 w-3.5" />
            )}
          </Button>
        ),
        cell: ({ row }) => {
          const raw = row.getValue("occurredAt") as string
          return <span>{dateFormatter.format(new Date(raw))}</span>
        },
      },
      {
        id: "description",
        header: "Descrição",
        cell: ({ row }) => (
          <span>{row.original.description?.trim() || "-"}</span>
        ),
      },
      {
        accessorKey: "category",
        header: "Categoria",
        cell: ({ row }) => (
          <span className="text-relic">{row.getValue("category") as string}</span>
        ),
      },
      {
        accessorKey: "amount",
        header: "Valor",
        cell: ({ row }) => {
          const amount = Number(row.getValue("amount"))
          const type = row.original.type
          const isIncome = type === "INCOME"

          return (
            <span className={isIncome ? "text-toxic font-semibold" : "text-ember font-semibold"}>
              {isIncome ? "+ " : "- "}
              {currencyFormatter.format(amount)}
            </span>
          )
        },
      },
    ],
    [],
  )

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  return (
    <div className="mx-auto flex h-full w-full max-w-350 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-linear-to-b from-arcane to-arcane/20" />
        <h1 className="font-heading text-2xl font-bold tracking-wider text-foreground">Finanças</h1>
      </div>

      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.8)]">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-relic">
                  Carregando transações...
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-relic">
                  Nenhuma transação cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
