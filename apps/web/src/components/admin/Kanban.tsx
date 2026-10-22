import { DndContext, PointerSensor, closestCorners, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { ORDER_STATUSES, canTransition, type OrderStatus } from "@do/shared";
import { Link } from "react-router-dom";
import { dateTime, money } from "../../lib/format";
import { STATUS_LABEL } from "../../lib/status";
import type { OrderSummary } from "../../lib/types";

type Col = { total: number; items: OrderSummary[] };
type Board = Record<string, Col>;

function Card({ o }: { o: OrderSummary }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: o.id, data: { status: o.status } });
  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
  };
  return (
    <article ref={setNodeRef} style={style} {...listeners} {...attributes}
      className="card cursor-grab space-y-1 p-3 active:cursor-grabbing">
      <Link to={`/admin/orders/${o.id}`} className="font-display font-bold" dir="ltr" onClick={(e) => e.stopPropagation()}>{o.orderNo}</Link>
      <p className="text-xs text-muted">{o.user?.fullName ?? "—"}</p>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted">{dateTime(o.createdAt)}</span>
        <span className="font-semibold text-primary">{money(o.total)}</span>
      </div>
    </article>
  );
}

function Column({ status, col }: { status: OrderStatus; col: Col }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section className={`flex min-w-[16rem] flex-1 flex-col rounded-xl2 border border-line/10 bg-surface2/40 ${isOver ? "ring-2 ring-primary/50" : ""}`}>
      <header className="flex items-center justify-between px-3 py-3">
        <h3 className="text-sm font-bold">{STATUS_LABEL[status]}</h3>
        <span className="rounded-full bg-line/10 px-2 py-0.5 text-xs text-muted">{col.total}</span>
      </header>
      <div ref={setNodeRef} className="flex min-h-[12rem] flex-1 flex-col gap-2 overflow-y-auto p-2">
        {col.items.map((o) => <Card key={o.id} o={o} />)}
      </div>
    </section>
  );
}

export default function Kanban({ board, onMove }: { board: Board; onMove: (id: string, from: OrderStatus, to: OrderStatus) => void }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  function onDragEnd(e: DragEndEvent) {
    const to = e.over?.id as OrderStatus | undefined;
    const from = e.active.data.current?.status as OrderStatus | undefined;
    const id = String(e.active.id);
    if (!to || !from || to === from) return;
    if (!canTransition(from, to)) return;
    onMove(id, from, to);
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={onDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {ORDER_STATUSES.map((s) => <Column key={s} status={s} col={board[s] ?? { total: 0, items: [] }} />)}
      </div>
    </DndContext>
  );
}
