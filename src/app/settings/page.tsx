import { SettingsForm } from "@/components/settings/SettingsForm";
import { settingsService } from "@/services/settings.service";
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";

export default async function SettingsPage() {
  const settings = await settingsService.getSettings();
  const connectedPage = await FacebookPageRepository.getConnectedPage();

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-slate-500">
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
