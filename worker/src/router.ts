import type { RequestContext } from "./types/context";
import * as stats from "./routes/stats";
import * as exportRoutes from "./routes/export";
import * as auth from "./routes/auth";
import * as oauth from "./routes/oauth";
import * as desqta from "./routes/desqta";
import * as bsplus from "./routes/bsplus";
import * as settingsSyncBsplus from "./routes/settings-sync-bsplus";
import * as cloudSummary from "./routes/cloud-summary";
import * as discord from "./routes/discord";
import * as admin from "./routes/admin";
import * as settings from "./routes/settings";
import * as user from "./routes/user";
import * as googleCalendar from "./routes/google-calendar";

type Route = {
  test: (method: string, pathname: string) => boolean;
  handle: (ctx: RequestContext) => Promise<Response | null | undefined>;
};

/** Same order as legacy `worker/index.js` if-chain (first match wins). */
const routes: Route[] = [
  { test: (m, p) => m === "GET" && p === "/api/stats/discord", handle: (c) => stats.handleStatsDiscord(c) },
  { test: (m, p) => m === "GET" && p === "/api/export/users/count", handle: (c) => exportRoutes.handleExportUsersCount(c) },
  {
    test: (m, p) => m === "GET" && p === "/api/export/reserved-clients",
    handle: (c) => exportRoutes.handleExportReservedClients(c),
  },
  { test: (m, p) => m === "GET" && p === "/api/export/users/full", handle: (c) => exportRoutes.handleExportUsersFull(c) },
  { test: (m, p) => m === "GET" && p === "/api/export/users/contact", handle: (c) => exportRoutes.handleExportUsersContact(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/register", handle: (c) => auth.handleRegister(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/login", handle: (c) => auth.handleLogin(c) },
  { test: (m, p) => m === "GET" && p === "/api/auth/me", handle: (c) => auth.handleMe(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/refresh", handle: (c) => auth.handleRefresh(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/migrate-session", handle: (c) => auth.handleMigrateSession(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/logout", handle: (c) => auth.handleLogout(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/logout-all", handle: (c) => auth.handleLogoutAll(c) },
  { test: (m, p) => m === "GET" && p === "/api/auth/sessions", handle: (c) => auth.handleListSessions(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/sessions/revoke-others", handle: (c) => auth.handleRevokeOtherSessions(c) },
  {
    test: (m, p) => m === "DELETE" && p.startsWith("/api/auth/sessions/") && p !== "/api/auth/sessions/revoke-others",
    handle: (c) => auth.handleRevokeSession(c),
  },
  { test: (m, p) => m === "POST" && p === "/api/auth/change-password", handle: (c) => auth.handleChangePassword(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/change-email", handle: (c) => auth.handleChangeEmail(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/forgot-password", handle: (c) => auth.handleForgotPassword(c) },
  { test: (m, p) => m === "GET" && p === "/api/auth/verify-reset-token", handle: (c) => auth.handleVerifyResetToken(c) },
  { test: (m, p) => m === "POST" && p === "/api/auth/reset-password", handle: (c) => auth.handleResetPassword(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/client", handle: (c) => oauth.handleOAuthClient(c) },
  { test: (m, p) => m === "POST" && p === "/api/oauth/approve", handle: (c) => oauth.handleOAuthApprove(c) },
  { test: (m, p) => m === "POST" && p === "/api/oauth/token", handle: (c) => oauth.handleOAuthToken(c) },
  { test: (m, p) => m === "POST" && p === "/api/oauth/refresh", handle: (c) => oauth.handleOAuthRefresh(c) },
  { test: (m, p) => m === "POST" && p === "/api/oauth/revoke", handle: (c) => oauth.handleOAuthRevoke(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/userinfo", handle: (c) => oauth.handleOAuthUserinfo(c) },
  { test: (m, p) => m === "POST" && p === "/api/desqta/client/reserve", handle: (c) => desqta.handleDesqtaReserve(c) },
  { test: (m, p) => m === "GET" && p === "/api/desqta/config", handle: (c) => desqta.handleDesqtaConfig(c) },
  { test: (m, p) => m === "POST" && p === "/api/desqta/refresh", handle: (c) => desqta.handleDesqtaRefresh(c) },
  { test: (m, p) => m === "POST" && p === "/api/desqta/login", handle: (c) => desqta.handleDesqtaLogin(c) },
  { test: (m, p) => m === "POST" && p === "/api/bsplus/client/reserve", handle: (c) => bsplus.handleBsplusReserve(c) },
  { test: (m, p) => m === "GET" && p === "/api/bsplus/config", handle: (c) => bsplus.handleBsplusConfig(c) },
  { test: (m, p) => m === "POST" && p === "/api/bsplus/refresh", handle: (c) => bsplus.handleBsplusRefresh(c) },
  { test: (m, p) => m === "POST" && p === "/api/bsplus/login", handle: (c) => bsplus.handleBsplusLogin(c) },
  {
    test: (m, p) => m === "POST" && p === "/api/bsplus/google/calendar/token",
    handle: (c) => googleCalendar.handleGoogleCalendarTokenExchange(c),
  },
  {
    test: (m, p) => m === "POST" && p === "/api/bsplus/google/calendar/refresh",
    handle: (c) => googleCalendar.handleGoogleCalendarTokenRefresh(c),
  },
  { test: (m, p) => p === "/api/bsplus/settings/sync", handle: (c) => settingsSyncBsplus.handleBsplusSettingsSync(c) },
  { test: (m, p) => m === "GET" && p === "/api/user/cloud-summary", handle: (c) => cloudSummary.handleCloudSummary(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/discord", handle: (c) => discord.handleDiscordOAuthStart(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/discord/callback", handle: (c) => discord.handleDiscordOAuthCallback(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/bsplus/discord", handle: (c) => discord.handleBsplusDiscordForward(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/desqta/discord", handle: (c) => discord.handleDesqtaDiscordStart(c) },
  { test: (m, p) => m === "GET" && p === "/api/oauth/desqta/discord/callback", handle: (c) => discord.handleDesqtaDiscordCallback(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/users", handle: (c) => admin.handleAdminUsers(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/promote", handle: (c) => admin.handleAdminPromote(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/send-password-reset", handle: (c) => admin.handleAdminSendPasswordReset(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/delete-user", handle: (c) => admin.handleAdminDeleteUser(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/clients", handle: (c) => admin.handleAdminClientsGet(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/desqta-clients-count", handle: (c) => admin.handleAdminDesqtaClientsCount(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/clients", handle: (c) => admin.handleAdminClientsPost(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/clients/delete", handle: (c) => admin.handleAdminClientsDelete(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/api-keys", handle: (c) => admin.handleAdminApiKeysGet(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/api-keys", handle: (c) => admin.handleAdminApiKeysPost(c) },
  { test: (m, p) => m === "DELETE" && p === "/api/admin/api-keys", handle: (c) => admin.handleAdminApiKeysDelete(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/update-user", handle: (c) => admin.handleAdminUpdateUser(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/user/pfp", handle: (c) => admin.handleAdminUserPfpGet(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/user/pfp", handle: (c) => admin.handleAdminUserPfpUpload(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/user/pfp/revert", handle: (c) => admin.handleAdminUserPfpRevert(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/user/pfp/clear", handle: (c) => admin.handleAdminUserPfpClear(c) },
  { test: (m, p) => m === "GET" && p === "/api/admin/audit-log", handle: (c) => admin.handleAdminAuditLog(c) },
  { test: (m, p) => m === "POST" && p === "/api/settings/sync-init", handle: (c) => settings.handleSettingsSyncInit(c) },
  { test: (m, p) => p === "/api/settings", handle: (c) => settings.handleSettings(c) },
  { test: (m, p) => m === "POST" && p === "/api/user/update", handle: (c) => user.handleUserUpdate(c) },
  { test: (m, p) => m === "GET" && p === "/api/user/pfp/history", handle: (c) => user.handleUserPfpHistory(c) },
  { test: (m, p) => m === "POST" && p === "/api/user/pfp/revert", handle: (c) => user.handleUserPfpRevert(c) },
  { test: (m, p) => m === "POST" && p === "/api/user/pfp/clear", handle: (c) => user.handleUserPfpClear(c) },
  { test: (m, p) => m === "POST" && p === "/api/user/pfp", handle: (c) => user.handleUserPfp(c) },
  { test: (m, p) => m === "GET" && p.startsWith("/api/user/pfp/") && p.split("/").length >= 5, handle: (c) => user.handleUserPfpGet(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/process-pfps", handle: (c) => admin.handleAdminProcessPfps(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/migrate-pfps", handle: (c) => admin.handleAdminMigratePfps(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/fix-pfp-urls", handle: (c) => admin.handleAdminFixPfpUrls(c) },
  { test: (m, p) => m === "POST" && p === "/api/admin/prune-pfp-history", handle: (c) => admin.handleAdminPrunePfpHistory(c) },
];

export async function dispatch(ctx: RequestContext): Promise<Response | null> {
  const method = ctx.request.method;
  const pathname = ctx.url.pathname;
  for (const route of routes) {
    if (route.test(method, pathname)) {
      const res = await route.handle(ctx);
      return res ?? null;
    }
  }
  return null;
}
