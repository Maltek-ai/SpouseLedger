// Deployment smoke check: confirms the app is up and which commit is live.
export function GET() {
  return Response.json({
    ok: true,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    env: process.env.VERCEL_ENV ?? "development",
  });
}
