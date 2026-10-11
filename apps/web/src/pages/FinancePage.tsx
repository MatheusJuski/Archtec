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

import { motion } from "motion/react"
import { api } from "@/lib/api"
import { Panel } from "@/components/ui/panel"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Stat } from "@/components/ui/stat"
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

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="hatch border border-dashed border-line px-4 py-8 text-center">
      <span className="label-tech text-muted-foreground">{children}</span>
    </div>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; payload?: { color?: string } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const numeric = typeof item.value === "number" ? item.value : Number(item.value ?? 0)
  return (
    <div className="border border-ink bg-popover px-3 py-2 shadow-[3px_3px_0_0_var(--ink)]">
      <p className="label-tech flex items-center gap-2 text-muted-foreground">
        <span className="size-2" style={{ backgroundColor: item.payload?.color }} />
        {item.name}
      </p>
      <p className="mt-1 font-mono text-sm tabular-nums text-foreground">
        {currencyFormatter.format(Number.isFinite(numeric) ? numeric : 0)}
      </p>
    </div>
  )
}

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

interface MonthlyGoal {
  id: string
  month: number
  year: number
  category: string
  targetAmount: number
}

interface AccountEntry {
  id: string
  type: "PAYABLE" | "RECEIVABLE"
  status: "PENDING" | "PAID" | "OVERDUE"
  amount: number
  category: string
  description: string | null
  dueDate: string
}

interface FinanceInsights {
  month: number
  year: number
  income: number
  expense: number
  projectedExpense: number
  projectedBalance: number
  overdueCount: number
  dueSoonCount: number
  daysInMonth: number
  elapsedDays: number
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
  const [savingGoal, setSavingGoal] = useState(false)
  const [savingAccount, setSavingAccount] = useState(false)
  const [insights, setInsights] = useState<FinanceInsights | null>(null)
  const [goals, setGoals] = useState<MonthlyGoal[]>([])
  const [accounts, setAccounts] = useState<AccountEntry[]>([])
  const [goalCategory, setGoalCategory] = useState("")
  const [goalAmount, setGoalAmount] = useState("")
  const [accountType, setAccountType] = useState<"PAYABLE" | "RECEIVABLE">("PAYABLE")
  const [accountCategory, setAccountCategory] = useState("")
  const [accountDescription, setAccountDescription] = useState("")
  const [accountAmount, setAccountAmount] = useState("")
  const [accountDueDate, setAccountDueDate] = useState(new Date().toISOString().slice(0, 10))
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
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()

    const [transactionsRes, expensesRes, goalsRes, accountsRes, insightsRes] = await Promise.all([
      api.get<Transaction[]>('/transactions'),
      api.get<ExpensesByCategoryResponse>('/transactions/expenses-by-category'),
      api.get<MonthlyGoal[]>('/finance/goals', { params: { month, year } }),
      api.get<AccountEntry[]>('/finance/accounts', { params: { month, year } }),
      api.get<FinanceInsights>('/finance/insights', { params: { month, year } }),
    ])

    setTransactions(transactionsRes.data)
    setExpensesByCategory(expensesRes.data.items)
    setGoals(goalsRes.data)
    setAccounts(accountsRes.data)
    setInsights(insightsRes.data)
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

  async function handleSaveGoal() {
    const category = goalCategory.trim()
    const amount = Number(goalAmount.replace(',', '.'))
    const now = new Date()

    if (!category || !Number.isFinite(amount) || amount <= 0) {
      toast.error('Preencha categoria e valor da meta corretamente')
      return
    }

    setSavingGoal(true)
    try {
      await api.post('/finance/goals', {
        category,
        targetAmount: amount,
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      })
      setGoalCategory('')
      setGoalAmount('')
      await fetchTransactions()
      toast.success('Meta salva com sucesso')
    } catch {
      toast.error('Erro ao salvar meta')
    } finally {
      setSavingGoal(false)
    }
  }

  async function handleDeleteGoal(goalId: string) {
    setSavingGoal(true)
    try {
      await api.delete(`/finance/goals/${goalId}`)
      await fetchTransactions()
      toast.success('Meta removida')
    } catch {
      toast.error('Erro ao remover meta')
    } finally {
      setSavingGoal(false)
    }
  }

  async function handleSaveAccount() {
    const category = accountCategory.trim()
    const amount = Number(accountAmount.replace(',', '.'))
    if (!category || !Number.isFinite(amount) || amount <= 0 || !accountDueDate) {
      toast.error('Preencha os dados do lançamento corretamente')
      return
    }

    setSavingAccount(true)
    try {
      await api.post('/finance/accounts', {
        type: accountType,
        category,
        description: accountDescription.trim() || undefined,
        amount,
        dueDate: new Date(`${accountDueDate}T12:00:00`).toISOString(),
      })
      setAccountCategory('')
      setAccountDescription('')
      setAccountAmount('')
      setAccountType('PAYABLE')
      setAccountDueDate(new Date().toISOString().slice(0, 10))
      await fetchTransactions()
      toast.success('Lançamento salvo')
    } catch {
      toast.error('Erro ao salvar lançamento')
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleMarkAccountPaid(id: string) {
    setSavingAccount(true)
    try {
      await api.post(`/finance/accounts/${id}/pay`)
      await fetchTransactions()
      toast.success('Lançamento marcado como pago')
    } catch {
      toast.error('Erro ao atualizar lançamento')
    } finally {
      setSavingAccount(false)
    }
  }

  async function handleDeleteAccount(id: string) {
    setSavingAccount(true)
    try {
      await api.delete(`/finance/accounts/${id}`)
      await fetchTransactions()
      toast.success('Lançamento removido')
    } catch {
      toast.error('Erro ao remover lançamento')
    } finally {
      setSavingAccount(false)
    }
  }

  const columns = useMemo<ColumnDef<Transaction>[]>(
    () => [
      {
        accessorKey: "occurredAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            className="-ml-2 h-7 px-2 font-mono text-[0.6875rem] uppercase tracking-[0.08em]"
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
          return <span className="font-mono text-xs tabular-nums text-muted-foreground">{dateFormatter.format(new Date(raw))}</span>
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
          <span className="border border-line px-1.5 py-0.5 font-mono text-[0.6875rem] text-muted-foreground">{row.getValue("category") as string}</span>
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
            <span className={`font-mono tabular-nums ${isIncome ? "text-success" : "text-foreground"}`}>
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
          <div className="flex items-center gap-1 opacity-60 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => openEditModal(row.original)}
              title="Editar transação"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:text-destructive"
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

  const spentByCategory = useMemo(() => {
    const now = new Date()
    return transactions.reduce<Record<string, number>>((acc, tx) => {
      const txDate = new Date(tx.occurredAt)
      if (
        tx.type === 'EXPENSE' &&
        txDate.getMonth() === now.getMonth() &&
        txDate.getFullYear() === now.getFullYear()
      ) {
        acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount
      }
      return acc
    }, {})
  }, [transactions])

  function getAccountVisualState(entry: AccountEntry) {
    if (entry.status === 'PAID') {
      return {
        cardClass: 'border-l-success',
        badgeClass: 'bg-success text-surface-1',
        label: 'Pago',
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const dueDate = new Date(entry.dueDate)
    dueDate.setHours(0, 0, 0, 0)

    const dayDiff = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (entry.status === 'OVERDUE' || dayDiff < 0) {
      return {
        cardClass: 'border-l-destructive bg-destructive/5',
        badgeClass: 'bg-destructive text-destructive-foreground',
        label: 'Atrasado',
      }
    }

    if (dayDiff <= 7) {
      return {
        cardClass: 'border-l-signal',
        badgeClass: 'bg-signal text-signal-foreground',
        label: 'Vence em breve',
      }
    }

    return {
      cardClass: 'border-l-line',
      badgeClass: 'bg-surface-2 text-muted-foreground',
      label: 'Pendente',
    }
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="mx-auto flex w-full max-w-350 flex-col gap-6 px-5 py-8 md:px-10 md:py-12">
      <PageHeader
        eyebrow="05 / Finanças"
        title="Finanças"
        description="Livro-caixa, projeções, metas e contas do mês."
        className="mb-2"
        actions={
          <Button variant="brand" onClick={openCreateModal}>
            <Plus />
            Nova transação
          </Button>
        }
      />

      <Panel
        title="Despesas por categoria"
        aside={<span className="label-tech">{chartMonthLabel || "Mês atual"}</span>}
      >
        {expensesByCategory.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-[minmax(0,300px)_1fr] md:items-center">
            <div className="relative h-70 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expensesByCategory}
                    dataKey="amount"
                    nameKey="category"
                    cx="50%"
                    cy="50%"
                    innerRadius={78}
                    outerRadius={108}
                    paddingAngle={1.5}
                    stroke="var(--card)"
                    strokeWidth={2}
                  >
                    {expensesByCategory.map((entry) => (
                      <Cell key={entry.category} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="label-tech text-muted-foreground">Total gasto</span>
                <span className="mt-1 font-mono text-xl font-medium tabular-nums">{currencyFormatter.format(chartTotal)}</span>
              </div>
            </div>

            <div className="divide-y divide-line border-y border-line">
              {expensesByCategory.map((item) => {
                const share = chartTotal > 0 ? (item.amount / chartTotal) * 100 : 0

                return (
                  <div key={item.category} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="size-2.5 shrink-0" style={{ backgroundColor: item.color }} aria-hidden />
                      <span className="text-sm">{item.category}</span>
                    </div>
                    <p className="font-mono text-sm tabular-nums">{currencyFormatter.format(item.amount)}</p>
                    <div className="h-1 bg-surface-2">
                      <motion.div
                        className="h-full"
                        style={{ backgroundColor: item.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${share}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                    <p className="label-tech text-right tabular-nums text-muted-foreground">{share.toFixed(1)}%</p>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <EmptyState>Sem despesas no período para montar o gráfico.</EmptyState>
        )}
      </Panel>

      <Panel title="Transações" aside={<span className="label-tech tabular-nums">{transactions.length} registros</span>} flush>
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
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-6" />
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className="group">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <span className="label-tech text-muted-foreground">Nenhuma transação cadastrada</span>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Projeção do mês">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Despesa atual" value={currencyFormatter.format(insights?.expense ?? 0)} tone="signal" />
            <Stat label="Despesa projetada" value={currencyFormatter.format(insights?.projectedExpense ?? 0)} tone="brand" />
            <Stat
              className="sm:col-span-2"
              label="Saldo projetado"
              value={currencyFormatter.format(insights?.projectedBalance ?? 0)}
              tone={(insights?.projectedBalance ?? 0) >= 0 ? "success" : "danger"}
              hint={`Baseado em ${insights?.elapsedDays ?? 0} de ${insights?.daysInMonth ?? 0} dias do mês`}
            />
          </div>
        </Panel>

        <Panel title="Alertas financeiros">
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat
              label="Contas atrasadas"
              value={insights?.overdueCount ?? 0}
              tone={(insights?.overdueCount ?? 0) > 0 ? "danger" : "success"}
            />
            <Stat
              label="Vencendo em 7 dias"
              value={insights?.dueSoonCount ?? 0}
              tone={(insights?.dueSoonCount ?? 0) > 0 ? "signal" : "success"}
            />
          </div>
        </Panel>

        <Panel title="Metas mensais">
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
            <Input
              placeholder="Categoria da meta"
              value={goalCategory}
              onChange={(e) => setGoalCategory(e.target.value)}
            />
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="Valor da meta"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              className="font-mono"
            />
            <Button onClick={handleSaveGoal} disabled={savingGoal}>Salvar</Button>
          </div>

          <div className="mt-4 space-y-3">
            {goals.length === 0 ? (
              <EmptyState>Nenhuma meta cadastrada para este mês.</EmptyState>
            ) : (
              goals.map((goal) => {
                const spent = spentByCategory[goal.category] ?? 0
                const progress = goal.targetAmount > 0 ? Math.min((spent / goal.targetAmount) * 100, 100) : 0
                const barTone = progress >= 100 ? "bg-destructive" : progress >= 80 ? "bg-signal" : "bg-success"
                return (
                  <div key={goal.id} className="group border border-line p-3 transition-colors hover:border-ink">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{goal.category}</p>
                      <Button variant="ghost" size="sm" className="h-7" onClick={() => handleDeleteGoal(goal.id)}>Remover</Button>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between gap-2">
                      <p className="font-mono text-xs tabular-nums text-muted-foreground">
                        {currencyFormatter.format(spent)} / {currencyFormatter.format(goal.targetAmount)}
                      </p>
                      <p className="label-tech tabular-nums">{Math.round(progress)}%</p>
                    </div>
                    <div className="hatch mt-2 h-2.5 border border-line">
                      <motion.div
                        className={`h-full ${barTone}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Panel>

        <Panel title="Contas a pagar e receber">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="arch-picker" value={accountType} onChange={(e) => setAccountType(e.target.value as 'PAYABLE' | 'RECEIVABLE')} aria-label="Tipo de lançamento">
              <option value="PAYABLE">A pagar</option>
              <option value="RECEIVABLE">A receber</option>
            </select>
            <Input placeholder="Categoria" value={accountCategory} onChange={(e) => setAccountCategory(e.target.value)} />
            <Input placeholder="Descrição" value={accountDescription} onChange={(e) => setAccountDescription(e.target.value)} />
            <Input type="number" step="0.01" min="0" placeholder="Valor" value={accountAmount} onChange={(e) => setAccountAmount(e.target.value)} className="font-mono" />
            <Input type="date" value={accountDueDate} onChange={(e) => setAccountDueDate(e.target.value)} className="font-mono text-xs" aria-label="Vencimento" />
            <Button onClick={handleSaveAccount} disabled={savingAccount}>Salvar lançamento</Button>
          </div>

          <div className="mt-4 space-y-2">
            {accounts.length === 0 ? (
              <EmptyState>Nenhum lançamento no mês atual.</EmptyState>
            ) : (
              accounts.map((entry) => {
                const visual = getAccountVisualState(entry)

                return (
                  <div key={entry.id} className={`border border-line border-l-[3px] p-3 transition-colors hover:border-ink ${visual.cardClass}`}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">
                        <span className="label-tech mr-2 text-muted-foreground">{entry.type === 'PAYABLE' ? 'Pagar' : 'Receber'}</span>
                        {entry.category}
                      </p>
                      <span className={`chip ${visual.badgeClass}`}>{visual.label}</span>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div>
                        <p className="font-mono text-lg tabular-nums">{currencyFormatter.format(entry.amount)}</p>
                        <p className="label-tech text-muted-foreground">Vence {dateFormatter.format(new Date(entry.dueDate))}</p>
                      </div>
                      <div className="flex gap-1.5">
                        {entry.status !== 'PAID' ? (
                          <Button size="sm" variant="outline" onClick={() => handleMarkAccountPaid(entry.id)}>
                            Marcar pago
                          </Button>
                        ) : null}
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteAccount(entry.id)}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </Panel>
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
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
                        <label className="flex h-10 cursor-pointer items-center gap-2.5 border border-input bg-card px-3 text-sm">
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
                          Frequência
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
                <Button type="submit" variant="brand" disabled={saving}>
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir transação</DialogTitle>
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
    </div>
  )
}
