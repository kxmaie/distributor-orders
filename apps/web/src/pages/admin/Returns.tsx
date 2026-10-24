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
 <section className="card space-y-4 p-5"><h2 className="font-bold">تسجيل مرتجع</h2><label className="label">{kind==="purchase"?"فاتورة الشراء":"الطلب المسلّم"}<select className="input" value={selected} onChange={e=>{setSelected(e.target.valu