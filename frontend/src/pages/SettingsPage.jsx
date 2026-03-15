import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Settings,
  Linkedin,
  CheckCircle,
  AlertCircle,
  Loader2,
  Unplug,
  Key,
  Info,
  Server,
} from 'lucide-react';
import { getLinkedInStatus, disconnectLinkedIn } from '../services/api';

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: linkedinStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['linkedinStatus'],
    queryFn: getLinkedInStatus,
  });

  const disconnectMutation = useMutation({
    mutationFn: disconnectLinkedIn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedinStatus'] });
      toast.success('LinkedIn disconnected');
    },
    onError: (err) => toast.error(err.message || 'Failed to disconnect'),
  });

  const isConnected = linkedinStatus?.connected || linkedinStatus?.is_connected;

  const handleConnect = () => {
    window.open('/api/linkedin/authorize', '_blank', 'width=600,height=700');
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Settings</h1>
        </div>

        {/* LinkedIn Connection */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Linkedin className="w-5 h-5 text-blue-400" />
            LinkedIn Connection
          </h2>

          {statusLoading ? (
            <div className="flex items-center gap-2 py-4">
              <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
              <span className="text-slate-400">Checking connection status...</span>
            </div>
          ) : isConnected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0" />
                <div>
                  <p className="text-green-400 font-medium">Connected</p>
                  <p className="text-slate-400 text-sm">
                    Your LinkedIn account is connected and ready to publish posts.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Disconnect your LinkedIn account?')) {
                    disconnectMutation.mutate();
                  }
                }}
                disabled={disconnectMutation.isPending}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-4 py-2.5 rounded-lg font-medium transition-colors"
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Unplug className="w-4 h-4" />
                )}
                Disconnect LinkedIn
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <AlertCircle className="w-6 h-6 text-amber-400 flex-shrink-0" />
                <div>
                  <p className="text-amber-400 font-medium">Not Connected</p>
                  <p className="text-slate-400 text-sm">
                    Connect your LinkedIn account to publish posts directly from this app.
                  </p>
                </div>
              </div>
              <button
                onClick={handleConnect}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Linkedin className="w-4 h-4" />
                Connect LinkedIn
              </button>
            </div>
          )}
        </div>

        {/* API Keys Info */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <Key className="w-5 h-5 text-cyan-400" />
            API Configuration
          </h2>

          <div className="flex items-start gap-3 p-4 bg-slate-900/50 border border-slate-700 rounded-lg mb-4">
            <Info className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-slate-400 text-sm leading-relaxed">
              <p className="mb-2">
                API keys are configured on the server side via environment variables.
                To set up or modify API keys, edit the <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">.env</code> file
                in the <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/</code> directory.
              </p>
              <p>
                Copy <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/.env.example</code> to
                <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded"> backend/.env</code> and fill in your keys.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-medium">ANTHROPIC_API_KEY</p>
                <p className="text-slate-500 text-xs">Required for AI post generation with Claude</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-medium">TMDB_API_KEY</p>
                <p className="text-slate-500 text-xs">Required for movie search via TMDB</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-medium">NEWS_API_KEY</p>
                <p className="text-slate-500 text-xs">Required for news article search</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
              <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
              <div>
                <p className="text-slate-300 text-sm font-medium">LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET</p>
                <p className="text-slate-500 text-xs">Required for LinkedIn OAuth and publishing</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
