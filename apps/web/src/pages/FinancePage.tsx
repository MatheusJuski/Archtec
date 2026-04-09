import { useCallback, useEffect, useMemo, useState } from "react"
import { ArrowDownAZ, ArrowUpZA, Pencil, Plus, Trash2 } from "lucide-react"
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
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"

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
type RecurrenceFrequency = "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY"

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
  categoryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida"),
  isRecurring: z.boolean(),
  recurrenceFrequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]).optional(),
}).superRefine((value, ctx) => {
  if (value.isRecurring && !value.recurrenceFrequency) {
    ctx.addIssue({
      code: "custom",
      path: ["recurrenceFrequency"],
      message: "Selecione a frequência da recorrência",
    })
  }
})

type CreateTransactionValues = z.infer<typeof createTransactionSchema>

interface Transaction {
  id: string
  amount: number
  type: TransactionType
  category: string
  categoryColor?: string | null
  description: string | null
  isRecurring?: boolean
  recurrenceFrequency?: RecurrenceFrequency | null
  occurredAt: string
  createdAt: string
  updatedAt: string
}

interface ExpensesByCategoryItem {
  category: string
  amount: number
  color: string
}

interface ExpensesByCategoryResponse {
  month: number
  year: number
  total: number
  items: ExpensesByCategoryItem[]
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
  const [expensesByCategory, setExpensesByCategory] = useState<ExpensesByCategoryItem[]>([])
  const [expensesMonth, setExpensesMonth] = useState<{ month: number; year: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [transactionToEdit, setTransactionToEdit] = useState<Transaction | null>(null)
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
      categoryColor: "#f97316",
      isRecurring: false,
      recurrenceFrequency: "DAILY",
    },
  })

  const isRecurring = form.watch("isRecurring")

  const fetchTransactions = useCallback(async () => {
    const [transactionsRes, expensesRes] = await Promise.all([
      api.get<Transaction[]>('/transactions'),
      api.get<ExpensesByCategoryResponse>('/transactions/expenses-by-category'),
    ])

    setTransactions(transactionsRes.data)
    setExpensesByCategory(expensesRes.data.items)
    setExpensesMonth({
      month: expensesRes.data.month,
      year: expensesRes.data.year,
    })
  }, [])

  useEffect(() => {
    fetchTransactions()
      .catch(() => toast.error("Erro ao carregar transações"))
      .finally(() => setLoading(false))
  }, [fetchTransactions])

  function resetFormToDefaults() {
    form.reset({
      type: "EXPENSE",
      category: "",
      description: "",
      amount: "",
      occurredAt: new Date().toISOString().slice(0, 10),
      categoryColor: "#f97316",
      isRecurring: false,
      recurrenceFrequency: "DAILY",
    })
  }

  function openCreateModal() {
    setTransactionToEdit(null)
    resetFormToDefaults()
    setIsCreateOpen(true)
  }

  function openEditModal(transaction: Transaction) {
    setTransactionToEdit(transaction)
    form.reset({
      type: transaction.type,
      category: transaction.category,
      description: transaction.description ?? "",
      amount: String(transaction.amount),
      occurredAt: transaction.occurredAt.slice(0, 10),
      categoryColor: transaction.categoryColor || "#f97316",
      isRecurring: Boolean(transaction.isRecurring),
      recurrenceFrequency: transaction.isRecurring
        ? transaction.recurrenceFrequency || "DAILY"
        : undefined,
    })
    setIsCreateOpen(true)
  }

  async function onCreateTransaction(values: CreateTransactionValues) {
    setSaving(true)
    try {
      const payload = {
        type: values.type,
        category: values.category,
        description: values.description?.trim() || undefined,
        categoryColor: values.categoryColor,
        amount: Number(values.amount.replace(",", ".")),
        occurredAt: new Date(`${values.occurredAt}T12:00:00`).toISOString(),
        isRecurring: values.isRecurring,
        recurrenceFrequency: values.isRecurring ? values.recurrenceFrequency ?? "DAILY" : undefined,
      }

      if (transactionToEdit) {
        await api.patch(`/transactions/${transactionToEdit.id}`, payload)
      } else {
        await api.post('/transactions', payload)
      }

      await fetchTransactions()
      setIsCreateOpen(false)
      setTransactionToEdit(null)
      resetFormToDefaults()
      toast.success(transactionToEdit ? "Transação atualizada com sucesso" : "Transação criada com sucesso")
    } catch (error: any) {
      const message = error?.response?.data?.message
      toast.error(Array.isArray(message) ? message[0] : message || "Erro ao salvar transação")
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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-relic hover:text-toxic"
              onClick={() => openEditModal(row.original)}
              title="Editar transação"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-relic hover:text-ember"
              onClick={() => openDeleteModal(row.original)}
              title="Excluir transação"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ],
    [openDeleteModal, openEditModal],
  )

  const table = useReactTable({
    data: transactions,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const chartMonthLabel = useMemo(() => {
    if (!expensesMonth) return ""

    return new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
    }).format(new Date(expensesMonth.year, expensesMonth.month - 1, 1))
  }, [expensesMonth])

  const chartTotal = useMemo(() => {
    return expensesByCategory.reduce((sum, item) => sum + item.amount, 0)
  }, [expensesByCategory])

  return (
    <div className="mx-auto flex h-full w-full max-w-350 flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-linear-to-b from-arcane to-arcane/20" />
        <h1 className="font-heading text-2xl font-bold tracking-wider text-foreground">Finanças</h1>
        <Button className="ml-auto" onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          Nova transação
        </Button>
      </div>

      <div className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-[0_18px_50px_-35px_rgba(0,0,0,0.8)]">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-heading text-sm tracking-wider text-foreground">Despesas por categoria</h2>
            <p className="text-xs text-relic">{chartMonthLabel || "Mês atual"}</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wide text-relic">Total gasto</p>
            <p className="font-heading text-lg text-ember">{currencyFormatter.format(chartTotal)}</p>
          </div>
        </div>

        {expensesByCategory.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-[minmax(0,340px)_1fr] md:items-center">
            <div className="h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={64}
                    outerRadius={96}
                    paddingAngle={2}
                    stroke="transparent"
                  >
                    {expensesByCategory.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => {
                      const numericValue =
                        typeof value === "number" ? value : Number(value ?? 0)
                      return currencyFormatter.format(Number.isFinite(numericValue) ? numericValue : 0)
                    }}
                    contentStyle={{
                      backgroundColor: "#0f172a",
                      border: "1px solid #334155",
                      borderRadius: "0.6rem",
                      color: "#e2e8f0",
                    }}
                    itemStyle={{ color: "#e2e8f0" }}
                    labelStyle={{ color: "#94a3b8" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {expensesByCategory.map((item) => {
                const share = chartTotal > 0 ? (item.amount / chartTotal) * 100 : 0

                return (
                  <div
                    key={item.category}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-background/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: item.color }}
                        aria-hidden
                      />
                      <span className="text-sm text-foreground">{item.category}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{currencyFormatter.format(item.amount)}</p>
                      <p className="text-xs text-relic">{share.toFixed(1)}%</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border/70 bg-background/40 px-4 py-7 text-center text-sm text-relic">
            Sem despesas no período para montar o gráfico.
          </div>
        )}
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

      <Dialog
        open={isCreateOpen}
        onOpenChange={(open) => {
          setIsCreateOpen(open)
          if (!open) {
            setTransactionToEdit(null)
            resetFormToDefaults()
          }
        }}
      >
        <DialogContent className="border-border bg-card/95 text-foreground backdrop-blur">
          <DialogHeader>
            <DialogTitle className="font-heading tracking-wide">
              {transactionToEdit ? "Editar transação" : "Nova transação"}
            </DialogTitle>
            <DialogDescription>
              {transactionToEdit
                ? "Atualize os dados da transação selecionada."
                : "Registre uma receita ou despesa para atualizar o livro-caixa."}
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
                name="categoryColor"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cor da categoria</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-3">
                        <Input type="color" className="h-10 w-16 p-1" {...field} />
                        <Input readOnly value={field.value} className="font-mono" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="isRecurring"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recorrência</FormLabel>
                      <FormControl>
                        <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm">
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={(event) => {
                              const checked = event.target.checked
                              field.onChange(checked)

                              if (checked) {
                                form.setValue("recurrenceFrequency", "DAILY", {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                                form.clearErrors("recurrenceFrequency")
                              }
                            }}
                          />
                          Repetir todos os meses
                        </label>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {isRecurring ? (
                  <FormField
                    control={form.control}
                    name="recurrenceFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Frequência</FormLabel>
                        <FormControl>
                          <select
                            className="arch-picker h-10 w-full"
                            value={field.value || "DAILY"}
                            onChange={(event) => field.onChange(event.target.value)}
                          >
                            <option value="DAILY">Diária</option>
                            <option value="WEEKLY">Semanal</option>
                            <option value="MONTHLY">Mensal</option>
                            <option value="YEARLY">Anual</option>
                          </select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
              </div>

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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false)
                    setTransactionToEdit(null)
                    resetFormToDefaults()
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : transactionToEdit ? "Salvar alterações" : "Salvar"}
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
