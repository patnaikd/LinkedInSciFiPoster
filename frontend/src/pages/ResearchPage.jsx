import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Newspaper,
  Search,
  Plus,
  Trash2,
  ArrowRight,
  Link,
  FileText,
  Loader2,
  ExternalLink,
  Globe,
  Type,
} from 'lucide-react';
import {
  getPost,
  searchNews,
  addResearchItem,
  deleteResearchItem,
  getResearchItems,
} from '../services/api';

export default function ResearchPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [newsSearchQuery, setNewsSearchQuery] = useState('');
  const [newsResults, setNewsResults] = useState([]);
  const [isSearchingNews, setIsSearchingNews] = useState(false);
  const [manualTab, setManualTab] = useState('url');
  const [urlForm, setUrlForm] = useState({ url: '', title: '', notes: '' });
  const [textForm, setTextForm] = useState({ title: '', snippet: '' });

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
  });

  const { data: researchItems = [], isLoading: researchLoading } = useQuery({
    queryKey: ['research', postId],
    queryFn: () => getResearchItems(postId),
  });

  const addMutation = useMutation({
    mutationFn: addResearchItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', postId] });
      toast.success('Research item added');
    },
    onError: (err) => toast.error(err.message || 'Failed to add research item'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteResearchItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['research', postId] });
      toast.success('Research item removed');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove'),
  });

  const parseThemes = (themes) => {
    if (Array.isArray(themes)) return themes;
    try {
      return JSON.parse(themes);
    } catch {
      return [];
    }
  };

  // Auto-search news based on sci-fi item themes
  useEffect(() => {
    if (post?.sci_fi_item) {
      const themes = parseThemes(post.sci_fi_item.themes);
      if (themes.length > 0) {
        const keywords = themes.join(' OR ');
        setNewsSearchQuery(keywords);
        handleNewsSearch(keywords);
      }
    }
  }, [post]);

  const handleNewsSearch = async (query) => {
    const q = query || newsSearchQuery;
    if (!q.trim()) return;
    setIsSearchingNews(true);
    try {
      const results = await searchNews(q);
      setNewsResults(Array.isArray(results) ? results : results.articles || []);
    } catch (err) {
      toast.error('News search failed');
    } finally {
      setIsSearchingNews(false);
    }
  };

  const handleAddNewsItem = (article) => {
    addMutation.mutate({
      post_id: parseInt(postId),
      source_type: 'news',
      title: article.title,
      url: article.url,
      snippet: article.description || article.snippet || '',
      source_name: article.source?.name || article.source_name || '',
    });
  };

  const handleAddUrl = (e) => {
    e.preventDefault();
    if (!urlForm.url.trim() || !urlForm.title.trim()) {
      toast.error('URL and title are required');
      return;
    }
    addMutation.mutate({
      post_id: parseInt(postId),
      source_type: 'url',
      title: urlForm.title,
      url: urlForm.url,
      snippet: urlForm.notes,
      source_name: '',
    });
    setUrlForm({ url: '', title: '', notes: '' });
  };

  const handleAddText = (e) => {
    e.preventDefault();
    if (!textForm.title.trim() || !textForm.snippet.trim()) {
      toast.error('Title and text are required');
      return;
    }
    addMutation.mutate({
      post_id: parseInt(postId),
      source_type: 'text',
      title: textForm.title,
      url: '',
      snippet: textForm.snippet,
      source_name: '',
    });
    setTextForm({ title: '', snippet: '' });
  };

  if (postLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-2">
          <Newspaper className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Research</h1>
        </div>
        {post?.sci_fi_item && (
          <p className="text-slate-400 mb-8">
            Gathering research for: <span className="text-cyan-400 font-medium">{post.sci_fi_item.title}</span>
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - News Search */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                News Search
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newsSearchQuery}
                  onChange={(e) => setNewsSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleNewsSearch()}
                  placeholder="Search for news articles..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                />
                <button
                  onClick={() => handleNewsSearch()}
                  disabled={isSearchingNews}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSearchingNews ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </div>

            {/* News Results */}
            <div className="space-y-3">
              {isSearchingNews && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  <span className="ml-2 text-slate-400">Searching news...</span>
                </div>
              )}
              {!isSearchingNews && newsResults.length > 0 && (
                <h3 className="text-lg font-medium text-slate-300">
                  {newsResults.length} article{newsResults.length !== 1 ? 's' : ''} found
                </h3>
              )}
              {!isSearchingNews &&
                newsResults.map((article, idx) => (
                  <div
                    key={idx}
                    className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-medium mb-1">{article.title}</h4>
                        <p className="text-slate-500 text-xs mb-2">
                          {article.source?.name || article.source_name || 'Unknown source'}
                          {article.publishedAt
                            ? ` - ${new Date(article.publishedAt).toLocaleDateString()}`
                            : ''}
                        </p>
                        {(article.description || article.snippet) && (
                          <p className="text-slate-400 text-sm line-clamp-2">
                            {article.description || article.snippet}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAddNewsItem(article)}
                        disabled={addMutation.isPending}
                        className="flex-shrink-0 flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add
                      </button>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Right Panel - Saved Research */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-cyan-400" />
                Saved Research ({researchItems.length})
              </h2>

              {researchLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : researchItems.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                  <p>No research items yet.</p>
                  <p className="text-sm mt-1">Add news articles or manual entries below.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {researchItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900/50 rounded-lg border border-slate-700 p-3 flex items-start gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {item.source_type === 'news' && <Newspaper className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                          {item.source_type === 'url' && <Globe className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                          {item.source_type === 'text' && <Type className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />}
                          <h4 className="text-white text-sm font-medium truncate">{item.title}</h4>
                        </div>
                        {item.snippet && (
                          <p className="text-slate-400 text-xs line-clamp-2 ml-5.5">{item.snippet}</p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-cyan-400 text-xs hover:underline ml-5.5 flex items-center gap-1 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            View source
                          </a>
                        )}
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="flex-shrink-0 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Manual Input */}
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Manual Input</h3>
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setManualTab('url')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    manualTab === 'url'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Link className="w-4 h-4" />
                  Add URL
                </button>
                <button
                  onClick={() => setManualTab('text')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                    manualTab === 'text'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Type className="w-4 h-4" />
                  Add Text
                </button>
              </div>

              {manualTab === 'url' ? (
                <form onSubmit={handleAddUrl} className="space-y-3">
                  <input
                    type="url"
                    value={urlForm.url}
                    onChange={(e) => setUrlForm({ ...urlForm, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                  />
                  <input
                    type="text"
                    value={urlForm.title}
                    onChange={(e) => setUrlForm({ ...urlForm, title: e.target.value })}
                    placeholder="Title"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                  />
                  <textarea
                    value={urlForm.notes}
                    onChange={(e) => setUrlForm({ ...urlForm, notes: e.target.value })}
                    placeholder="Notes (optional)"
                    rows={2}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={addMutation.isPending}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add URL
                  </button>
                </form>
              ) : (
                <form onSubmit={handleAddText} className="space-y-3">
                  <input
                    type="text"
                    value={textForm.title}
                    onChange={(e) => setTextForm({ ...textForm, title: e.target.value })}
                    placeholder="Title"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                  />
                  <textarea
                    value={textForm.snippet}
                    onChange={(e) => setTextForm({ ...textForm, snippet: e.target.value })}
                    placeholder="Text snippet"
                    rows={4}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={addMutation.isPending}
                    className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Text
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Navigation */}
        <div className="mt-8 flex justify-end">
          <button
            onClick={() => navigate(`/author/${postId}`)}
            className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-xl font-semibold text-lg transition-colors"
          >
            Continue to Authoring
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
