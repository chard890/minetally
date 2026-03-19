import { SettingsForm } from "@/components/settings/SettingsForm";
import { SupabaseConfigGuide } from "@/components/workflow/SupabaseConfigGuide";
import { isFacebookAuthConfigured } from "@/lib/facebook-auth";
import { isSupabaseConfigured } from "@/lib/supabase";
import { FacebookConnectionSessionRepository } from "@/repositories/facebook-connection-session.repository";
import { settingsService } from "@/services/settings.service";
import { FacebookPageRepository } from "@/repositories/facebook-page.repository";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseConfigGuide />;
  }

  const resolvedSearchParams = searchParams ? await searchParams : {};
  const settings = await settingsService.getSettings();
  const connectedPage = await FacebookPageRepository.getConnectedPage();
  const facebookSessionId = typeof resolvedSearchParams.facebook_session === 'string'
    ? resolvedSearchParams.facebook_session
    : undefined;
  const pendingConnection = facebookSessionId
    ? await FacebookConnectionSessionRepository.getSession(facebookSessionId)
    : null;
  const facebookError = typeof resolvedSearchParams.facebook_error === 'string'
    ? resolvedSearchParams.facebook_error
    : null;
  const facebookStatus = typeof resolvedSearchParams.facebook_status === 'string'
    ? resolvedSearchParams.facebook_status
    : null;

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
        pendingFacebookConnection={pendingConnection}
        facebookAuthConfigured={isFacebookAuthConfigured()}
        facebookError={facebookError}
        facebookStatus={facebookStatus}
      />
    </div>
  );
}
