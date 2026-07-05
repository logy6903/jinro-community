import { AppDashboard } from "@/components/builder/AppDashboard";

// Teacher dashboard for one app: share link + collected submissions.
// Owner-gated inside the client component (authenticated fetch).

export default async function BuilderAppPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AppDashboard appId={id} />;
}
