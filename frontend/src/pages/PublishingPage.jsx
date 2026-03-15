import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Send,
  Linkedin,
  CheckCircle,
  ExternalLink,
  Loader2,
  Plus,
  History,
  AlertCircle,
  Eye,
} from 'lucide-react';
import {
  getPost,
  getLinkedInStatus,
  publishToLinkedIn,
} from '../services/api';

export default function PublishingPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [published, setPublished] = useState(false);
  const [linkedinUrl, setLinkedinUrl] = useState('');

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
  });

  const { data: linkedinStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['linkedinStatus'],
    queryFn: getLinkedInStatus,
  });

  const publishMutation = useMutation({
    mutationFn: publishToLinkedIn,
    onSuccess: (data) => {
      setPublished(true);
      setLinkedinUrl(data.linkedin_url || data.url || '');
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Published to LinkedIn!');
    },
    onError: (err) => toast.error(err.message || 'Publishing failed'),
  });

  const handleConnect = () => {
    window.open('/api/linkedin/authorize', '_blank', 'width=600,height=700');
  };

  const handlePublish = () => {
    publishMutation.mutate({ post_id: parseInt(postId) });
  };

  const isConnected = linkedinStatus?.connected || linkedinStatus?.is_connected;

  if (postLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Send className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Publish</h1>
        </div>

        {published ? (
          /* Success State */
          <div className="bg-slate-800 rounded-xl border border-green-500/30 p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Published Successfully!</h2>
            <p className="text-slate-400 mb-6">
              Your post has been published to LinkedIn.
            </p>

            {linkedinUrl && (
              <a
                href={linkedinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors mb-4"
              >
                <ExternalLink className="w-5 h-5" />
                View on LinkedIn
              </a>
            )}

            <div className="flex justify-center gap-4 mt-4">
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create Another Post
              </button>
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-slate-300 px-5 py-2.5 rounded-lg font-medium transition-colors"
              >
                <History className="w-4 h-4" />
                View History
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* LinkedIn Preview Card */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 mb-6 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-white">LinkedIn Preview</h2>
                </div>
                <span
                  className={`text-sm ${
                    (post?.content?.length || 0) > 3000 ? 'text-red-400' : 'text-slate-500'
                  }`}
                >
                  {post?.content?.length || 0} characters
                </span>
              </div>

              {/* Mock LinkedIn Post */}
              <div className="p-6">
                <div className="bg-white rounded-lg p-6 text-slate-900 max-h-96 overflow-y-auto">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                      <Linkedin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Your Name</p>
                      <p className="text-slate-500 text-sm">Just now</p>
                    </div>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {post?.content || 'No content yet.'}
                  </div>
                </div>
              </div>
            </div>

            {/* Connection Status & Publish */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Linkedin className="w-5 h-5 text-blue-400" />
                LinkedIn Connection
              </h3>

              {statusLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  <span className="ml-2 text-slate-400">Checking connection...</span>
                </div>
              ) : isConnected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium">Connected to LinkedIn</span>
                  </div>
                  <button
                    onClick={handlePublish}
                    disabled={publishMutation.isPending || !post?.content}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-semibold text-lg transition-colors"
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    {publishMutation.isPending ? 'Publishing...' : 'Publish to LinkedIn'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertCircle className="w-5 h-5" />
                    <span className="font-medium">Not connected to LinkedIn</span>
                  </div>
                  <p className="text-slate-400 text-sm">
                    Connect your LinkedIn account to publish posts directly.
                  </p>
                  <button
                    onClick={handleConnect}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-semibold transition-colors"
                  >
                    <Linkedin className="w-5 h-5" />
                    Connect LinkedIn
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
