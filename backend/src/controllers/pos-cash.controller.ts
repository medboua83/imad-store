import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import {
  getCashState,
  openCashSession,
  closeCashSession,
  recoverCashAction,
  readCashSession,
  listCashSessions,
} from "../lib/pos-cash";
export async function posCashState(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await getCashState(req.user!) });
}
export async function posCashOpen(req: AuthRequest, res: Response) {
  const r = await openCashSession(req.user!, req.header("Idempotency-Key") ?? "", req.body);
  res.status(r.replay ? 200 : 201).json({ success: true, ...r });
}
export async function posCashClose(req: AuthRequest, res: Response) {
  const r = await closeCashSession(req.user!, req.header("Idempotency-Key") ?? "", req.body);
  res.status(r.replay ? 200 : 201).json({ success: true, ...r });
}
export async function posCashRecover(req: AuthRequest, res: Response) {
  res.json({ success: true, ...(await recoverCashAction(req.user!, String(req.params.key))) });
}
export async function posCashRead(req: AuthRequest, res: Response) {
  res.json({ success: true, data: await readCashSession(req.user!, String(req.params.id)) });
}
export async function posCashList(req: AuthRequest, res: Response) {
  res.json({ success: true, ...(await listCashSessions(req.user!, req.query)) });
}
