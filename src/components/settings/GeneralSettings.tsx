import { TerminologySelector } from "./TerminologySelector";
import { TimezoneSelector } from "./TimezoneSelector";
import { SidebarPagesVisibility } from "./SidebarPagesVisibility";
import { OtherWorkspaces } from "./OtherWorkspaces";
import { AdminPhoneSettings } from "./AdminPhoneSettings";
import { ThemeSelector } from "./ThemeSelector";
import { WorkspaceProfileSettings } from "./WorkspaceProfileSettings";

export const GeneralSettings = () => {

  return (
    <div className="space-y-6">
      <WorkspaceProfileSettings />

      <AdminPhoneSettings />

      <ThemeSelector />

      <TimezoneSelector />

      <TerminologySelector />

      <SidebarPagesVisibility />

      <OtherWorkspaces />
    </div>
  );
};
