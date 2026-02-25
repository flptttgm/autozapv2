import { AdminLayout } from "@/components/admin/AdminLayout";
import { PlatformLogsViewer } from "@/components/admin/PlatformLogsViewer";

export default function AdminLogs() {
  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Logs da Plataforma</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Visualize todas as atividades e eventos da plataforma
          </p>
        </div>

        <PlatformLogsViewer />
      </div>
    </AdminLayout>
  );
}
