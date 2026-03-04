import { TerminologySelector } from "./TerminologySelector";
import { TimezoneSelector } from "./TimezoneSelector";
import { SidebarPagesVisibility } from "./SidebarPagesVisibility";
import { AdminPhoneSettings } from "./AdminPhoneSettings";
import { ThemeSelector } from "./ThemeSelector";

export const GeneralSettings = () => {

  return (
    <div className="space-y-6">
      <AdminPhoneSettings />

      <ThemeSelector />

      <TimezoneSelector />

      <TerminologySelector />

      <SidebarPagesVisibility />
    </div>
  );
};
