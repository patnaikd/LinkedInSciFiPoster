import { Key, Info, Server, Settings } from 'lucide-react';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Settings className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Settings</h1>
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
                Copy <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/.env.example</code> to{' '}
                <code className="bg-slate-700 text-cyan-400 px-1.5 py-0.5 rounded">backend/.env</code> and fill in your keys.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'ANTHROPIC_API_KEY', desc: 'Required for AI post generation with Claude' },
              { key: 'TMDB_API_KEY', desc: 'Required for movie search via TMDB' },
              { key: 'TMDB_API_READ_ACCESS_TOKEN', desc: 'Required for TMDB v4 API access' },
              { key: 'NEWS_API_KEY', desc: 'Required for news article search' },
              { key: 'FAL_KEY', desc: 'Required for AI image generation via fal.ai' },
            ].map(({ key, desc }) => (
              <div key={key} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                <Server className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <div>
                  <p className="text-slate-300 text-sm font-medium">{key}</p>
                  <p className="text-slate-500 text-xs">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
