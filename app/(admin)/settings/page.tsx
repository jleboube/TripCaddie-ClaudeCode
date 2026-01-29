import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { getQueueStats } from "@/lib/queue";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings - TripCaddie Admin",
};

async function getSystemInfo() {
  const [userCount, configCount] = await Promise.all([
    prisma.user.count(),
    prisma.systemConfig.count(),
  ]);

  let queueStats = null;
  try {
    queueStats = await getQueueStats();
  } catch (e) {
    // Redis might not be available
  }

  return { userCount, configCount, queueStats };
}

export default async function SettingsPage() {
  const info = await getSystemInfo();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          System configuration and status
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Current system information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Admin Users</span>
              <span className="font-medium">{info.userCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">System Configs</span>
              <span className="font-medium">{info.configCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Environment</span>
              <span className="font-medium">
                {process.env.NODE_ENV || "development"}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Queue Status</CardTitle>
            <CardDescription>Background job processing</CardDescription>
          </CardHeader>
          <CardContent>
            {info.queueStats ? (
              <div className="space-y-4">
                {Object.entries(info.queueStats).map(([name, stats]) => (
                  <div key={name}>
                    <p className="font-medium capitalize">{name} Agent</p>
                    <div className="grid grid-cols-3 gap-2 text-sm mt-1">
                      <div>
                        <span className="text-muted-foreground">Active: </span>
                        {(stats as Record<string, number>).active || 0}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Waiting: </span>
                        {(stats as Record<string, number>).waiting || 0}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Failed: </span>
                        {(stats as Record<string, number>).failed || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Queue status unavailable - Redis may be offline
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
          <CardDescription>
            System settings are managed via environment variables
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To modify system configuration, update the environment variables in your
            deployment configuration or .env file and restart the application.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
