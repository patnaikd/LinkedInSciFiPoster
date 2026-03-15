import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  History,
  FileText,
  Send,
  Trash2,
  ArrowRight,
  ExternalLink,
  Loader2,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import { getPosts, deletePost } from '../services/api';

const TONE_LABELS = {
  professional_witty: 'Professional & Witty',
  thought_leadership: 'Thought Leadership',
  casual_fun: 'Casual & Fun',
  provocative: 'Provocative',
  storytelling: 'Storytelling',
};

export default function HistoryPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('draft');

  const { data: drafts = [], isLoading: draftsLoading } = useQuery({
    queryKey: ['posts', 'draft'],
    queryFn: () => getPosts({ status: 'draft' }),
  });

  const { data: published = [], isLoading: publishedLoading } = useQuery({
    queryKey: ['posts', 'published'],
    queryFn: () => getPosts({ status: 'published' }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePost,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      toast.success('Post deleted');
    },
    onError: (err) => toast.error(err.message || 'Failed to delete'),
  });

  const getResumeRoute = (post) => {
    if (post.content && post.content.trim()) {
      return `/publish/${post.id}`;
    }
    if (post.sci_fi_item_id) {
      return `/research/${post.id}`;
    }
    return `/author/${post.id}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const items = activeTab === 'draft' ? drafts : published;
  const isLoading = activeTab === 'draft' ? draftsLoading : publishedLoading;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <History className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Post History</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('draft')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'draft'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            Drafts
            {drafts.length > 0 && (
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                {drafts.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('published')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors ${
              activeTab === 'published'
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
            }`}
          >
            <Send className="w-4 h-4" />
            Published
            {published.length > 0 && (
              <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">
                {published.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">
              {activeTab === 'draft' ? 'No drafts yet.' : 'No published posts yet.'}
            </p>
            <p className="text-sm mt-1">
              {activeTab === 'draft'
                ? 'Start by creating a new post from the Ideation page.'
                : 'Publish a draft to see it here.'}
            </p>
            {activeTab === 'draft' && (
              <button
                onClick={() => navigate('/')}
                className="mt-4 flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-5 py-2.5 rounded-lg font-medium transition-colors mx-auto"
              >
                Create New Post
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {items.map((post) => {
              const sciFiTitle = post.sci_fi_item?.title || 'Untitled';
              return (
                <div
                  key={post.id}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-white font-semibold text-lg truncate">
                          {sciFiTitle}
                        </h3>
                        {post.tone && (
                          <span className="bg-cyan-500/10 text-cyan-400 text-xs px-2.5 py-0.5 rounded-full border border-cyan-500/20 flex-shrink-0">
                            {TONE_LABELS[post.tone] || post.tone}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-slate-500 text-sm mb-3">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {activeTab === 'published' && post.published_at
                            ? `Published ${formatDate(post.published_at)}`
                            : `Created ${formatDate(post.created_at)}`}
                        </span>
                        {post.draft_number > 0 && (
                          <span className="text-slate-600">
                            - Draft #{post.draft_number}
                          </span>
                        )}
                      </div>
                      {post.content && (
                        <p className="text-slate-400 text-sm line-clamp-3">{post.content}</p>
                      )}
                      {activeTab === 'published' && (post.linkedin_url || post.linkedin_post_url) && (
                        <a
                          href={post.linkedin_url || post.linkedin_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 text-sm mt-2"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          View on LinkedIn
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {activeTab === 'draft' && (
                        <>
                          <button
                            onClick={() => navigate(getResumeRoute(post))}
                            className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                            Resume
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this draft?')) {
                                deleteMutation.mutate(post.id);
                              }
                            }}
                            disabled={deleteMutation.isPending}
                            className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-2 rounded-lg text-sm transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
