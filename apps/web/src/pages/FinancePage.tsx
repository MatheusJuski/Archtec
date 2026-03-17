import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpZA, Plus, Trash2 } from "lucide-react"
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table"
import { toast } from "sonner"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"

import { api } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TransactionType = "INCOME" | "EXPENSE"

const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], {
    message: "Selecione Receita ou Despesa",
  }),
  category: z.string().trim().min(1, "Categoria é obrigatória"),
  description: z.string().optional(),
  amount: z
    .string()
    .min(1, "Valor é obrigatório")
    .refine((value) => Number(value.replace(",", ".")) > 0, "Valor deve ser maior que zero"),
  occurredAt: z.string().min(1, "Data é obrigatória"),
})

type CreateTransactionValues = z.infer<typeof createTransactionSchema>

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
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [transactionToDelete, setTransactionToDelete] = useState<Transaction | null>(null)
  const [sorting, setSorting] = useState<SortingState>([
    { id: "occurredAt", desc: true },
  ])

  const form = useForm<CreateTransactionValues>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues: {
      type: "EXPENSE",
      category: "",
      description: "",
      amount: "",
      occurredAt: new Date().toISOString().slice(0, 10),
    },
  })

  const fetchTransactions = useCallback(async () => {
    const res = await api.get<Transaction[]>('/transactions')
    setTransactions(res.data)
  }, [])

  useEffect(() => {
    fetchTransactions()
      .catch(() => toast.error("Erro ao carregar transações"))
      .finally(() => setLoading(false))
  }, [fetchTransactions])

  async function onCreateTransaction(values: CreateTransactionValues) {
    setSaving(true)
    try {
      await api.post('/transactions', {
        type: values.type,
        category: values.category,
        description: values.description?.trim() || undefined,
        amount: Number(values.amount.replace(",", ".")),
        occurredAt: new Date(`${values.occurredAt}T12:00:00`).toISOString(),
      })

      await fetchTransactions()
      setIsCreateOpen(false)
      form.reset({
        type: "EXPENSE",
        category: "",
        description: "",
        amount: "",
        occurredAt: new Date().toISOString().slice(0, 10),
      })
      toast.success("Transação criada com sucesso")
    } catch (error: any) {
      const message = error?.response?.data?.message
      toast.error(Array.isArray(message) ? message[0] : message || "Erro ao criar transação")
    } finally {
      setSaving(false)
    }
  }

  function openDeleteModal(transaction: Transaction) {
    setTransactionToDelete(transaction)
  }

  async function confirmDeleteTransaction() {
    if (!transactionToDelete) return

    setDeleting(true)
    try {
      await api.delete(`/transactions/${transactionToDelete.id}`)
      await fetchTransactions()
      setTransactionToDelete(null)
      toast.success("Transação excluída")
    } catch (error: any) {
      const message = error?.response?.data?.message
      toast.error(Array.isArray(message) ? message[0] : message || "Erro ao excluir transação")
    } finally {
      setDeleting(false)
    }
  }

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
      {
        id: "actions",
        header: "Ações",
        enableSorting: false,
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-relic hover:text-ember"
            onClick={() => openDeleteModal(row.original)}
            title="Excluir transação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [openDeleteModal],
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
        <Button className="ml-auto" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Nova transação
        </Button>
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
                <TableCell colSpan={5} className="h-24 text-center text-relic">
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
                <TableCell colSpan={5} className="h-24 text-center text-relic">
                  Nenhuma transação cadastrada.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="border-border bg-card/95 text-foreground backdrop-blur">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide">Nova transação</DialogTitle>
            <DialogDescription>
              Registre uma receita ou despesa para atualizar o livro-caixa.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreateTransaction)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <FormControl>
                      <select className="arch-picker" {...field}>
                        <option value="EXPENSE">Despesa</option>
                        <option value="INCOME">Receita</option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoria</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Alimentação" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descrição</FormLabel>
                    <FormControl>
                      <Input placeholder="Opcional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="occurredAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(transactionToDelete)}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setTransactionToDelete(null)
          }
        }}
      >
        <DialogContent className="border-border bg-card/95 text-foreground backdrop-blur sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide">Excluir transação</DialogTitle>
            <DialogDescription>
              {transactionToDelete
                ? `Tem certeza que deseja excluir a transação de ${currencyFormatter.format(transactionToDelete.amount)} da categoria ${transactionToDelete.category}?`
                : "Tem certeza que deseja excluir esta transação?"}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTransactionToDelete(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteTransaction}
              disabled={deleting}
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
