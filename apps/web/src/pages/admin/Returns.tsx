import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, errorText } from "../../lib/api";
import { useAdminOrders, useAdminOrderDetail } from "../../hooks/adminQueries";

import { useUI } from "../../store/ui";
import { money } from "../../lib/format";

type Purchase = {id:string;invoiceNo:string;supplier:string;total:string;items:{id:string;variantId:string;warehouseId:number;qty:number;unitCost:string;lineTotal:string;variant:{sku:string;label:string;product:{name:string}};warehouse:{name:string}}[]};
type ReturnRow = {id:string;returnNo:string;total:string;createdAt:string; supplier?:string;purchase?:{invoiceNo:string};order?:{orderNo:string;user:{fullName:string}}};
export default function Returns({kind}:{kind:"purchase"|"sales"}) {
 const push=useUI(s=>s.push), qc=useQueryClient(); const [selected,setSelected]=useState(""); const [qty,setQty]=useState<Record<string,number>>({}); const [note,setNote]=useState("");
 const purchases=useQuery({queryKey:["purchases"],queryFn:()=>api.get<Purchase[]>("/admin/purchases"),enabled:kind==="purchase"});
 const orders=useAdminOrders({status:"delivered",page:1,pageSize:100}); const order=useAdminOrderDetail(kind==="sales"?selected:null);
 const returns=useQuery({queryKey:["returns",kind],queryFn:()=>api.get<ReturnRow[]>(`/admin/returns/${kind === "purchase" ? "purchases" : "sales"}`)});
 const selectedPurchase=purchases.data?.find(p=>p.id===selected); const selectedOrder=order.data;
 const lines=kind==="purchase"?(selectedPurchase?.items??[]).map(x=>({key:x.id,variantId:x.variantId,warehouseId:x.warehouseId,label:`${x.variant.product.name} · ${x.variant.label}`,qtyMax:x.qty,price:x.unitCost})): (selectedOrder?.items??[]).map(x=>({key:x.id,variantId:x.variantId,warehouseId:selectedOrder?.warehouse.id??0,label:`${x.productName} · ${x.variantLabel}`,qtyMax:x.qty,price:x.lineTotal && x.qty ? (Number(x.lineTotal)/x.qty).toFixed(2):x.unitPrice}));
 const save=useMutation({mutationFn:()=>api.post(`/admin/returns/${kind === "purchase" ? "purchases" : "sales"}`,kind==="purchase"?{purchaseId:selected,note,items:lines.filter(x=>(qty[x.key]??0)>0).map(x=>({purchaseItemId:x.key,qty:qty[x.key]}))}:{orderId:selected,note,items:lines.filter(x=>(qty[x.key]??0)>0).map(x=>({orderItemId:x.key,qty:qty[x.key]}))}),onSuccess:()=>{push("تم تسجيل المرتجع وعكس الكمية من المخزون","ok");setQty({});setNote("");qc.invalidateQueries({queryKey:["returns"]});qc.invalidateQueries({queryKey:["admin","stock"]});qc.invalidateQueries({queryKey:["purchases"]});},onError:e=>push(errorText(e),"err")});
 const title=kind==="purchase"?"مرتجعات المشتريات":"مرتجعات المبيعات";
 return <div className="space-y-6"><header><h1 className="font-display text-2xl font-extrabold">{title}</h1><p className="mt-1 text-sm text-muted">{kind==="purchase"?"إرجاع مشتريات يخصم الكمية المرتجعة من المخزون ولا يسمح بتجاوز المتاح.":"إرجاع مبيعات للطلبات المسلّمة فقط، ويعيد الكمية للمخزن مع منع تجاوز الكمية المسلّمة."}</p></header>
 <section className="card space-y-4 p-5"><h2 className="font-bold">تسجيل مرتجع</h2><label className="label">{kind==="purchase"?"فاتورة الشراء":"الطلب المسلّم"}<select className="input" value={selected} onChange={e=>{setSelected(e.target.value);setQty({});}}><option value="">اختر {kind==="purchase"?"فاتورة":"طلبًا"}</option>{kind==="purchase"?purchases.data?.map(p=><option key={p.id} value={p.id}>{p.invoiceNo} · {p.supplier}</option>):orders.data?.items.map(o=><option key={o.id} value={o.id}>{o.orderNo} · {o.user?.fullName??""}</option>)}</select></label>
 {lines.length>0&&<div className="space-y-2">{lines.map(x=><div key={x.key} className="grid items-center gap-3 rounded-xl border border-line/10 p-3 sm:grid-cols-[1fr_auto_auto]"><div>{x.label}<small className="ms-2 text-muted">{kind==="purchase"?"التكلفة":"سعر البيع"}: {money(x.price)} · أقصى كمية {x.qtyMax}</small></div><input className="input w-28" type="number" min="0" max={x.qtyMax} value={qty[x.key]??0} onChange={e=>setQty(q=>({...q,[x.key]:Math.min(x.qtyMax,Math.max(0,Number(e.target.value)))}))} aria-label="كمية المرتجع"/><strong>{money(Number(x.price)*(qty[x.key]??0))}</strong></div>)}</div>}
 <label className="label">ملاحظة<input className="input" maxLength={500} value={note} onChange={e=>setNote(e.target.value)}/></label><button className="btn-primary" disabled={!selected||!lines.some(x=>(qty[x.key]??0)>0)||save.isPending} onClick={()=>save.mutate()}>تسجيل {title}</button></section>
 <section className="card p-5"><h2 className="mb-4 font-bold">سجل المرتجعات</h2>{returns.data?.map(r=><div key={r.id} className="flex justify-between border-t border-line/10 py-3"><span>{r.returnNo} · {kind==="purchase"?`${r.purchase?.invoiceNo??""} · ${r.supplier??""}`:r.order?.orderNo} · {new Date(r.createdAt).toLocaleDateString("ar-EG")}</span><b>{money(r.total)}</b></div>)}{returns.data?.length===0&&<p className="text-sm text-muted">لا توجد مرتجعات مسجلة.</p>}</section></div>;
}
