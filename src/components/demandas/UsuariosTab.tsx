import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  listUsers,
  createUser,
  deleteUser,
  setUserAdmin,
  resetUserPassword,
} from "@/lib/users-admin.functions";
import { toast } from "sonner";
import { Shield, ShieldOff, Trash2, KeyRound, UserPlus, Loader2 } from "lucide-react";

type User = {
  id: string;
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
};

export function UsuariosTab() {
  const list = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const del = useServerFn(deleteUser);
  const setAdmin = useServerFn(setUserAdmin);
  const resetPwd = useServerFn(resetUserPassword);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await list();
      setUsers(data as User[]);
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao listar usuários");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await create({ data: { email: newEmail.trim(), password: newPwd, is_admin: newIsAdmin } });
      toast.success("Usuário criado");
      setNewEmail(""); setNewPwd(""); setNewIsAdmin(false);
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao criar");
    } finally {
      setCreating(false);
    }
  }

  async function toggleAdmin(u: User) {
    setBusyId(u.id);
    try {
      await setAdmin({ data: { user_id: u.id, is_admin: !u.is_admin } });
      toast.success(!u.is_admin ? "Admin concedido" : "Admin removido");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setBusyId(null); }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Remover ${u.email}? Esta ação não pode ser desfeita.`)) return;
    setBusyId(u.id);
    try {
      await del({ data: { user_id: u.id } });
      toast.success("Usuário removido");
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setBusyId(null); }
  }

  async function handleReset(u: User) {
    const pwd = prompt(`Nova senha para ${u.email} (mín. 6 caracteres):`);
    if (!pwd) return;
    setBusyId(u.id);
    try {
      await resetPwd({ data: { user_id: u.id, password: pwd } });
      toast.success("Senha atualizada");
    } catch (e: any) {
      toast.error(e.message ?? "Erro");
    } finally { setBusyId(null); }
  }

  return (
    <div className="space-y-6">
      <div className="filter-panel rounded-xl p-5 border border-border/60">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="w-4 h-4 text-accent" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Novo usuário</h2>
        </div>
        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto_auto] gap-3 items-end">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Email</label>
            <input type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-surface border border-border/60 text-sm" />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Senha</label>
            <input type="text" required minLength={6} value={newPwd} onChange={(e) => setNewPwd(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-surface border border-border/60 text-sm font-mono" />
          </div>
          <label className="flex items-center gap-2 text-sm pb-2 cursor-pointer">
            <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} />
            Admin
          </label>
          <button type="submit" disabled={creating}
            className="px-4 py-2 rounded-lg gradient-primary text-white text-sm font-medium shadow-[var(--glow-primary)] disabled:opacity-50 flex items-center gap-2">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Criar
          </button>
        </form>
      </div>

      <div className="rounded-xl border border-border/60 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface/60 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Papel</th>
              <th className="text-left px-4 py-3">Criado</th>
              <th className="text-left px-4 py-3">Último login</th>
              <th className="text-right px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Carregando...</td></tr>
            )}
            {!loading && users.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Nenhum usuário</td></tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border/40 hover:bg-surface/40 transition">
                <td className="px-4 py-3">
                  <div className="font-medium">{u.email}</div>
                  {!u.email_confirmed_at && <div className="text-[10px] text-warning font-mono">não confirmado</div>}
                </td>
                <td className="px-4 py-3">
                  {u.is_admin ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-accent/15 text-accent border border-accent/30">
                      <Shield className="w-3 h-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground font-mono">user</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {new Date(u.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={busyId === u.id}
                      title={u.is_admin ? "Remover admin" : "Tornar admin"}
                      className="p-2 rounded-lg hover:bg-accent/15 text-muted-foreground hover:text-accent transition disabled:opacity-50"
                    >
                      {u.is_admin ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleReset(u)}
                      disabled={busyId === u.id}
                      title="Redefinir senha"
                      className="p-2 rounded-lg hover:bg-surface text-muted-foreground hover:text-foreground transition disabled:opacity-50"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      disabled={busyId === u.id}
                      title="Remover usuário"
                      className="p-2 rounded-lg hover:bg-danger/15 text-muted-foreground hover:text-danger transition disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
