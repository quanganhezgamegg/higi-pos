import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  deleteTable,
  listAreas,
  listTableStatus,
  setTableActive,
  type Area,
  type Table,
  type TableStatus,
} from "@/lib/api/tables"
import AreaManager from "@/routes/tables/AreaManager"
import TableCard from "@/routes/tables/TableCard"
import TableForm from "@/routes/tables/TableForm"

export default function Tables() {
  const [areas, setAreas] = useState<Area[]>([])
  const [statuses, setStatuses] = useState<TableStatus[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [editing, setEditing] = useState<Table | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const activeAreas = useMemo(() => areas.filter((area) => area.is_active), [areas])

  async function refresh() {
    setError(null)
    try {
      const [nextAreas, nextStatuses] = await Promise.all([listAreas(true), listTableStatus()])
      setAreas(nextAreas)
      setStatuses(nextStatuses)
    } catch (e) {
      setError(String(e))
    }
  }

  useEffect(() => {
    let active = true

    Promise.all([listAreas(true), listTableStatus()])
      .then(([nextAreas, nextStatuses]) => {
        if (!active) return
        setAreas(nextAreas)
        setStatuses(nextStatuses)
      })
      .catch((e) => {
        if (active) setError(String(e))
      })

    return () => {
      active = false
    }
  }, [])

  async function onDelete(table: Table) {
    setError(null)
    try {
      await deleteTable(table.id)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  async function onToggleActive(table: Table) {
    setError(null)
    try {
      await setTableActive(table.id, !table.is_active)
      await refresh()
    } catch (e) {
      setError(String(e))
    }
  }

  function onEdit(table: Table) {
    setEditing(table)
    setEditOpen(true)
  }

  function tablesForArea(areaId: number | null) {
    if (areaId === null) return statuses
    return statuses.filter((status) => status.table.area_id === areaId)
  }

  function renderTableGrid(items: TableStatus[], emptyLabel: string) {
    if (items.length === 0) {
      return <p className="py-6 text-sm text-muted-foreground">{emptyLabel}</p>
    }

    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((status) => (
          <TableCard
            key={status.table.id}
            status={status.status}
            table={status.table}
            onDelete={(table) => void onDelete(table)}
            onEdit={onEdit}
            onToggleActive={(table) => void onToggleActive(table)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Sơ đồ bàn</h1>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AreaManager onChanged={() => void refresh()} />
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="h-11">Thêm bàn</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Thêm bàn</DialogTitle>
              </DialogHeader>
              <TableForm
                areas={areas}
                onDone={() => {
                  setAddOpen(false)
                  void refresh()
                }}
              />
            </DialogContent>
          </Dialog>
          <Button className="h-11" variant="outline" asChild>
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa bàn</DialogTitle>
          </DialogHeader>
          <TableForm
            areas={areas}
            editing={editing}
            onDone={() => {
              setEditOpen(false)
              setEditing(null)
              void refresh()
            }}
          />
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="all">
        <TabsList className="h-auto flex-wrap justify-start">
          <TabsTrigger className="h-9 px-4" value="all">
            Tất cả
          </TabsTrigger>
          {activeAreas.map((area) => (
            <TabsTrigger className="h-9 px-4" key={area.id} value={String(area.id)}>
              {area.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          {renderTableGrid(tablesForArea(null), "Chưa có bàn nào.")}
        </TabsContent>

        {activeAreas.map((area) => (
          <TabsContent key={area.id} value={String(area.id)}>
            {renderTableGrid(tablesForArea(area.id), "Khu vực chưa có bàn.")}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
