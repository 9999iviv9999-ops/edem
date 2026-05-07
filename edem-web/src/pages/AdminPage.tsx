import { FormEvent, useEffect, useState } from "react";
import { api } from "../lib/api";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  isBanned: boolean;
  banReason?: string | null;
  createdAt: string;
};

type AdminReport = {
  id: string;
  reason: string;
  details?: string | null;
  status: "open" | "in_review" | "resolved" | "dismissed";
  createdAt: string;
  reporter: { id: string; name: string; email: string };
  reported: { id: string; name: string; email: string; isBanned: boolean };
};

type AdminAuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: string | null;
  createdAt: string;
  adminUser: { id: string; email: string; name: string };
};

type AdminGym = {
  id: string;
  name: string;
  address: string;
  city: string;
  chainName?: string | null;
};
type AdminProfileComment = {
  id: string;
  text: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  targetUser: { id: string; name: string; email: string };
};

type GymEditState = Record<string, { name: string; address: string; city: string; chainName: string }>;
type AdminStats = {
  registrationsToday: number;
  active24h: number;
  openReports: number;
  totalUsers: number;
};

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats>({
    registrationsToday: 0,
    active24h: 0,
    openReports: 0,
    totalUsers: 0
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [profileComments, setProfileComments] = useState<AdminProfileComment[]>([]);
  const [gyms, setGyms] = useState<AdminGym[]>([]);
  const [gymEdit, setGymEdit] = useState<GymEditState>({});
  const [usersQuery, setUsersQuery] = useState("");
  const [gymsQuery, setGymsQuery] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [reportsPage, setReportsPage] = useState(1);
  const [gymsPage, setGymsPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [commentsPage, setCommentsPage] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [reportsTotal, setReportsTotal] = useState(0);
  const [gymsTotal, setGymsTotal] = useState(0);
  const [auditTotal, setAuditTotal] = useState(0);
  const [commentsTotal, setCommentsTotal] = useState(0);
  const usersPageSize = 20;
  const reportsPageSize = 20;
  const gymsPageSize = 20;
  const auditPageSize = 20;
  const commentsPageSize = 20;

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [statsRes, usersRes, reportsRes, gymsRes, logsRes, commentsRes] = await Promise.all([
        api.get("/api/moderation/stats"),
        api.get("/api/moderation/users", {
          params: { q: usersQuery || undefined, page: usersPage, pageSize: usersPageSize }
        }),
        api.get("/api/moderation/reports", {
          params: { page: reportsPage, pageSize: reportsPageSize }
        }),
        api.get("/api/moderation/gyms", {
          params: { q: gymsQuery || undefined, page: gymsPage, pageSize: gymsPageSize }
        }),
        api.get("/api/moderation/audit-logs", {
          params: { page: auditPage, pageSize: auditPageSize }
        }),
        api.get("/api/moderation/profile-comments", {
          params: { page: commentsPage, pageSize: commentsPageSize }
        })
      ]);
      const usersRows = Array.isArray(usersRes.data?.items) ? usersRes.data.items : [];
      const reportsRows = Array.isArray(reportsRes.data?.items) ? reportsRes.data.items : [];
      const gymsRows = Array.isArray(gymsRes.data?.items) ? gymsRes.data.items : [];
      const auditRows = Array.isArray(logsRes.data?.items) ? logsRes.data.items : [];
      const commentsRows = Array.isArray(commentsRes.data?.items) ? commentsRes.data.items : [];
      setStats({
        registrationsToday: Number(statsRes.data?.registrationsToday || 0),
        active24h: Number(statsRes.data?.active24h || 0),
        openReports: Number(statsRes.data?.openReports || 0),
        totalUsers: Number(statsRes.data?.totalUsers || 0)
      });
      setUsers(usersRows);
      setReports(reportsRows);
      setUsersTotal(Number(usersRes.data?.total || 0));
      setReportsTotal(Number(reportsRes.data?.total || 0));
      setGyms(gymsRows);
      setGymsTotal(Number(gymsRes.data?.total || 0));
      setAuditLogs(auditRows);
      setAuditTotal(Number(logsRes.data?.total || 0));
      setProfileComments(commentsRows);
      setCommentsTotal(Number(commentsRes.data?.total || 0));
      setGymEdit(
        Object.fromEntries(
          gymsRows.map((g: AdminGym) => [
            g.id,
            {
              name: g.name || "",
              address: g.address || "",
              city: g.city || "",
              chainName: g.chainName || ""
            }
          ])
        )
      );
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось загрузить данные админки");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usersPage, reportsPage, gymsPage, auditPage, commentsPage]);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    setUsersPage(1);
    setGymsPage(1);
    await loadAll();
  }

  async function toggleBan(user: AdminUser) {
    setError("");
    setMessage("");
    try {
      await api.patch(
        `/api/moderation/users/${user.id}/ban`,
        {
          isBanned: !user.isBanned,
          reason: !user.isBanned ? "Violation of platform rules" : undefined
        }
      );
      setMessage(user.isBanned ? "Пользователь разблокирован" : "Пользователь заблокирован");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось обновить статус пользователя");
    }
  }

  async function updateReportStatus(reportId: string, status: AdminReport["status"]) {
    setError("");
    setMessage("");
    try {
      await api.patch(`/api/moderation/reports/${reportId}`, { status });
      setMessage("Статус жалобы обновлен");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось обновить жалобу");
    }
  }

  async function saveGym(gymId: string) {
    const edit = gymEdit[gymId];
    if (!edit) return;
    setError("");
    setMessage("");
    try {
      await api.patch(
        `/api/moderation/gyms/${gymId}`,
        {
          name: edit.name,
          address: edit.address,
          city: edit.city,
          chainName: edit.chainName || null
        }
      );
      setMessage("Карточка зала обновлена");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось сохранить зал");
    }
  }

  async function deleteProfileComment(commentId: string) {
    setError("");
    setMessage("");
    try {
      await api.delete(`/api/moderation/profile-comments/${commentId}`);
      setMessage("Комментарий удален");
      await loadAll();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Не удалось удалить комментарий");
    }
  }

  return (
    <div className="grid">
      <div className="card">
        <h3 className="page-title page-title--sm">Ключевые метрики</h3>
        <div className="grid two-col">
          <div className="list-item">
            <strong>Регистрации сегодня:</strong> {stats.registrationsToday}
          </div>
          <div className="list-item">
            <strong>Активные за 24ч:</strong> {stats.active24h}
          </div>
          <div className="list-item">
            <strong>Открытые жалобы:</strong> {stats.openReports}
          </div>
          <div className="list-item">
            <strong>Всего пользователей:</strong> {stats.totalUsers}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="page-title">Админка</h2>
        <p className="page-sub">Модерация пользователей, жалоб и каталога залов (доступ только для admin).</p>
        <form className="grid two-col" onSubmit={(e) => void onSearch(e)}>
          <div className="row">
            <button className="primary-btn" disabled={loading}>
              {loading ? "Загрузка..." : "Обновить данные"}
            </button>
          </div>
          {message && <div className="success full">{message}</div>}
          {error && <div className="error full">{error}</div>}
        </form>
      </div>

      <div className="card">
        <h3 className="page-title page-title--sm">Пользователи</h3>
        <form className="row" onSubmit={(e) => void onSearch(e)}>
          <input
            value={usersQuery}
            onChange={(e) => setUsersQuery(e.target.value)}
            placeholder="Поиск по имени, email или телефону"
          />
          <button className="ghost-btn" type="submit">
            Найти
          </button>
        </form>
        <div className="list">
          {users.map((u) => (
            <div key={u.id} className="list-item">
              <strong>{u.name}</strong> · {u.email} · {u.phone} · {u.city}
              <div className="row">
                <span>{u.isBanned ? `Заблокирован: ${u.banReason || "без причины"}` : "Активен"}</span>
                <button className="ghost-btn" onClick={() => void toggleBan(u)}>
                  {u.isBanned ? "Разблокировать" : "Заблокировать"}
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="ghost-btn" disabled={usersPage <= 1} onClick={() => setUsersPage((p) => p - 1)}>
            Назад
          </button>
          <span>
            Страница {usersPage} · всего {usersTotal}
          </span>
          <button
            className="ghost-btn"
            disabled={usersPage * usersPageSize >= usersTotal}
            onClick={() => setUsersPage((p) => p + 1)}
          >
            Вперед
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="page-title page-title--sm">Жалобы</h3>
        <div className="list">
          {reports.map((r) => (
            <div key={r.id} className="list-item">
              <strong>{r.reason}</strong> · {r.status}
              <div>
                От: {r.reporter.name} ({r.reporter.email}) → На: {r.reported.name} ({r.reported.email})
              </div>
              {r.details && <div>{r.details}</div>}
              <div className="row">
                <button className="ghost-btn" onClick={() => void updateReportStatus(r.id, "in_review")}>
                  В работу
                </button>
                <button className="ghost-btn" onClick={() => void updateReportStatus(r.id, "resolved")}>
                  Решено
                </button>
                <button className="ghost-btn" onClick={() => void updateReportStatus(r.id, "dismissed")}>
                  Отклонить
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="ghost-btn" disabled={reportsPage <= 1} onClick={() => setReportsPage((p) => p - 1)}>
            Назад
          </button>
          <span>
            Страница {reportsPage} · всего {reportsTotal}
          </span>
          <button
            className="ghost-btn"
            disabled={reportsPage * reportsPageSize >= reportsTotal}
            onClick={() => setReportsPage((p) => p + 1)}
          >
            Вперед
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="page-title page-title--sm">Каталог залов</h3>
        <form className="row" onSubmit={(e) => void onSearch(e)}>
          <input value={gymsQuery} onChange={(e) => setGymsQuery(e.target.value)} placeholder="Поиск залов" />
          <button className="ghost-btn" type="submit">
            Найти
          </button>
        </form>
        <div className="list">
          {gyms.map((g) => {
            const edit = gymEdit[g.id] || {
              name: g.name || "",
              address: g.address || "",
              city: g.city || "",
              chainName: g.chainName || ""
            };
            return (
              <div key={g.id} className="list-item">
                <div className="grid two-col">
                  <input
                    value={edit.name}
                    onChange={(e) =>
                      setGymEdit((s) => ({
                        ...s,
                        [g.id]: { ...edit, name: e.target.value }
                      }))
                    }
                    placeholder="Название"
                  />
                  <input
                    value={edit.city}
                    onChange={(e) =>
                      setGymEdit((s) => ({
                        ...s,
                        [g.id]: { ...edit, city: e.target.value }
                      }))
                    }
                    placeholder="Город"
                  />
                  <input
                    className="full"
                    value={edit.address}
                    onChange={(e) =>
                      setGymEdit((s) => ({
                        ...s,
                        [g.id]: { ...edit, address: e.target.value }
                      }))
                    }
                    placeholder="Адрес"
                  />
                  <input
                    className="full"
                    value={edit.chainName}
                    onChange={(e) =>
                      setGymEdit((s) => ({
                        ...s,
                        [g.id]: { ...edit, chainName: e.target.value }
                      }))
                    }
                    placeholder="Сеть"
                  />
                </div>
                <button className="ghost-btn" onClick={() => void saveGym(g.id)}>
                  Сохранить
                </button>
              </div>
            );
          })}
        </div>
        <div className="row">
          <button className="ghost-btn" disabled={gymsPage <= 1} onClick={() => setGymsPage((p) => p - 1)}>
            Назад
          </button>
          <span>
            Страница {gymsPage} · всего {gymsTotal}
          </span>
          <button
            className="ghost-btn"
            disabled={gymsPage * gymsPageSize >= gymsTotal}
            onClick={() => setGymsPage((p) => p + 1)}
          >
            Вперед
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="page-title page-title--sm">Комментарии к анкетам</h3>
        <div className="list">
          {profileComments.map((c) => (
            <div key={c.id} className="list-item">
              <strong>{c.author.name}</strong> ({c.author.email}) → <strong>{c.targetUser.name}</strong> ({c.targetUser.email})
              <div>{c.text}</div>
              <div className="row">
                <span>{new Date(c.createdAt).toLocaleString()}</span>
                <button className="ghost-btn" onClick={() => void deleteProfileComment(c.id)}>
                  Удалить комментарий
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="row">
          <button className="ghost-btn" disabled={commentsPage <= 1} onClick={() => setCommentsPage((p) => p - 1)}>
            Назад
          </button>
          <span>
            Страница {commentsPage} · всего {commentsTotal}
          </span>
          <button
            className="ghost-btn"
            disabled={commentsPage * commentsPageSize >= commentsTotal}
            onClick={() => setCommentsPage((p) => p + 1)}
          >
            Вперед
          </button>
        </div>
      </div>

      <div className="card">
        <h3 className="page-title page-title--sm">Аудит-лог админки</h3>
        <div className="list">
          {auditLogs.map((l) => (
            <div key={l.id} className="list-item">
              <strong>{l.action}</strong> · {l.entityType}:{l.entityId}
              <div>
                {new Date(l.createdAt).toLocaleString()} · {l.adminUser.email}
              </div>
              {l.payload ? <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{l.payload}</pre> : null}
            </div>
          ))}
        </div>
        <div className="row">
          <button className="ghost-btn" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>
            Назад
          </button>
          <span>
            Страница {auditPage} · всего {auditTotal}
          </span>
          <button
            className="ghost-btn"
            disabled={auditPage * auditPageSize >= auditTotal}
            onClick={() => setAuditPage((p) => p + 1)}
          >
            Вперед
          </button>
        </div>
      </div>
    </div>
  );
}
