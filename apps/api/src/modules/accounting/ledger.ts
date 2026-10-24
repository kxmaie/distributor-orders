import { Prisma } from "@prisma/client";
import type { Prisma as PrismaTypes } from "@prisma/client";
type Tx = PrismaTypes.TransactionClient;
export async function averageUnitCost(tx:Tx,variantId:bigint){
 const [bought,returned]=await Promise.all([
  tx.purchaseItem.aggregate({where:{variantId,purchase:{voidedAt:null}},_sum:{qty:true,lineTotal:true}}),
  tx.purchaseReturnItem.aggregate({where:{variantId,purchaseReturn:{purchase:{voidedAt:null}}},_sum:{qty:true,lineTotal:true}}),
 ]);
 const qty=(bought._sum.qty??0)-(returned._sum.qty??0);const value=new Prisma.Decimal(bought._sum.lineTotal??0).sub(returned._sum.lineTotal??0);
 return qty>0?value.div(qty):new Prisma.Decimal(0);
}
export async function postVoucher(tx:Tx,args:{type:"receipt"|"payment"|"journal";description:string;actorId:bigint;entries:{code:string;debit:string|Prisma.Decimal;credit:string|Prisma.Decimal}[]}){
 const totalDebit=args.entries.reduce((s,e)=>s.add(e.debit),new Prisma.Decimal(0));const totalCredit=args.entries.reduce((s,e)=>s.add(e.credit),new Prisma.Decimal(0));if(!totalDebit.equals(totalCredit)||totalDebit.lte(0))throw new Error("Unbalanced system voucher");
 const codes=[...new Set(args.entries.map(e=>e.code))];const accounts=await tx.ledgerAccount.findMany({where:{code:{in:codes},isActive:true},select:{id:true,code:true}});if(accounts.length!==codes.length)throw new Error(`Missing ledger accounts: ${codes.filter(c=>!accounts.some(a=>a.code===c)).join(",")}`);
 const byCode=new Map(accounts.map(a=>[a.code,a.id]));return tx.journalVoucher.create({data:{voucherNo:`JV-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type:args.type,description:args.description,createdBy:args.actorId,entries:{create:args.entries.map(e=>({accountId:byCode.get(e.code)!,debit:e.debit,credit:e.credit}))}}});
}
