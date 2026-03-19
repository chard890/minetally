import { SettingsForm } from "@/components/settings/SettingsForm";
import { settingsService } from "@/services/settings.service";
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";

export default async function SettingsPage() {
  const settings = await settingsService.getSettings();
  const connectedPage = await FacebookPageRepository.getConnectedPage();

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-[#8b8594]">Workspace</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-[#2b2b2b]">Settings</h1>
        <p className="mt-2 text-[#6b6b6b]">
          Configure your Facebook integration, claim keywords, and finalization rules.
        </p>
      </div>

      <SettingsForm 
        initialSettings={settings} 
        initialConnectedPage={connectedPage} 
      />
    </div>
  );
}
