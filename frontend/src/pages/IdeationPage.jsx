import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search,
  BookOpen,
  Film,
  Plus,
  Trash2,
  ArrowRight,
  Library,
  Sparkles,
  Loader2,
  ImageOff,
} from 'lucide-react';
import {
  searchBooks,
  searchMovies,
  getLibrary,
  saveToLibrary,
  deleteFromLibrary,
  createPost,
} from '../services/api';

export default function IdeationPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('books');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const { data: libraryItems = [], isLoading: libraryLoading } = useQuery({
    queryKey: ['library'],
    queryFn: getLibrary,
  });

  const saveMutation = useMutation({
    mutationFn: saveToLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('Saved to library');
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteFromLibrary,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] });
      toast.success('Removed from library');
    },
    onError: (err) => toast.error(err.message || 'Failed to remove'),
  });

  const createPostMutation = useMutation({
    mutationFn: createPost,
    onSuccess: (post) => {
      toast.success('Post created');
      navigate(`/research/${post.id}`);
    },
    onError: (err) => toast.error(err.message || 'Failed to create post'),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results =
        activeTab === 'books'
          ? await searchBooks(searchQuery)
          : await searchMovies(searchQuery);
      setSearchResults(results);
    } catch (err) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSearch();
  };

  const buildLibraryPayload = (item) => ({
    item_type: activeTab === 'books' ? 'book' : 'movie',
    title: item.title,
    author_or_director: item.author_or_director || item.author || item.director || '',
    year: item.year || null,
    description: item.description || '',
    cover_image_url: item.cover_image_url || '',
    external_id: item.external_id || '',
    themes: item.themes || [],
  });

  const handleSaveToLibrary = (item) => {
    saveMutation.mutate(buildLibraryPayload(item));
  };

  const handleUseForPost = async (item, libraryId) => {
    let itemId = libraryId;
    if (!itemId) {
      try {
        const saved = await saveMutation.mutateAsync(buildLibraryPayload(item));
        itemId = saved.id;
      } catch {
        return;
      }
    }
    createPostMutation.mutate({ sci_fi_item_id: itemId });
  };

  const isInLibrary = (item) =>
    libraryItems.some(
      (lib) =>
        lib.title === item.title &&
        lib.author_or_director === (item.author_or_director || item.author || item.director)
    );

  const parseThemes = (themes) => {
    if (Array.isArray(themes)) return themes;
    try {
      return JSON.parse(themes);
    } catch {
      return [];
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Sparkles className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Ideation</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Search */}
          <div className="space-y-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-cyan-400" />
                Search Sci-Fi
              </h2>

              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => {
                    setActiveTab('books');
                    setSearchResults([]);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'books'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Books
                </button>
                <button
                  onClick={() => {
                    setActiveTab('movies');
                    setSearchResults([]);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === 'movies'
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                      : 'bg-slate-700 text-slate-400 border border-slate-600 hover:text-slate-200'
                  }`}
                >
                  <Film className="w-4 h-4" />
                  Movies
                </button>
              </div>

              {/* Search Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={`Search ${activeTab}...`}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Search
                </button>
              </div>
            </div>

            {/* Search Results */}
            <div className="space-y-4">
              {searchResults.length > 0 && (
                <h3 className="text-lg font-medium text-slate-300">
                  {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} found
                </h3>
              )}
              {searchResults.map((item, idx) => (
                <div
                  key={item.external_id || idx}
                  className="bg-slate-800 rounded-xl border border-slate-700 p-4 flex gap-4 hover:border-slate-600 transition-colors"
                >
                  {item.cover_image_url ? (
                    <img
                      src={item.cover_image_url}
                      alt={item.title}
                      className="w-24 h-36 object-cover rounded-lg flex-shrink-0"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-24 h-36 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                      <ImageOff className="w-8 h-8 text-slate-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-white font-semibold text-lg">{item.title}</h4>
                    <p className="text-slate-400 text-sm mb-2">
                      {item.author_or_director || item.author || item.director}
                      {item.year ? ` (${item.year})` : ''}
                    </p>
                    {item.description && (
                      <p className="text-slate-400 text-sm mb-3 line-clamp-3">
                        {item.description}
                      </p>
                    )}
                    {item.themes && item.themes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {item.themes.map((theme, i) => (
                          <span
                            key={i}
                            className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/20"
                          >
                            {theme}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveToLibrary(item)}
                        disabled={isInLibrary(item) || saveMutation.isPending}
                        className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-3 py-1.5 rounded-lg text-sm transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {isInLibrary(item) ? 'In Library' : 'Save to Library'}
                      </button>
                      <button
                        onClick={() =>
                          handleUseForPost(
                            item,
                            libraryItems.find(
                              (lib) =>
                                lib.title === item.title &&
                                lib.author_or_director ===
                                  (item.author_or_director || item.author || item.director)
                            )?.id
                          )
                        }
                        disabled={createPostMutation.isPending}
                        className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {createPostMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ArrowRight className="w-3.5 h-3.5" />
                        )}
                        Use for Post
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Panel - Library */}
          <div>
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Library className="w-5 h-5 text-cyan-400" />
                My Library
              </h2>

              {libraryLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Library className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Your library is empty.</p>
                  <p className="text-sm mt-1">Search and save sci-fi items to get started.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {libraryItems.map((item) => {
                    const themes = parseThemes(item.themes);
                    return (
                      <div
                        key={item.id}
                        className="bg-slate-900/50 rounded-lg border border-slate-700 p-4 flex gap-3 hover:border-slate-600 transition-colors"
                      >
                        {item.cover_image_url ? (
                          <img
                            src={item.cover_image_url}
                            alt={item.title}
                            className="w-16 h-24 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="w-16 h-24 bg-slate-700 rounded-lg flex items-center justify-center flex-shrink-0">
                            {item.item_type === 'book' ? (
                              <BookOpen className="w-6 h-6 text-slate-500" />
                            ) : (
                              <Film className="w-6 h-6 text-slate-500" />
                            )}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-white font-medium truncate">{item.title}</h4>
                          <p className="text-slate-400 text-sm">
                            {item.author_or_director}
                            {item.year ? ` (${item.year})` : ''}
                          </p>
                          {themes.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {themes.slice(0, 3).map((theme, i) => (
                                <span
                                  key={i}
                                  className="bg-cyan-500/10 text-cyan-400 text-xs px-1.5 py-0.5 rounded-full"
                                >
                                  {theme}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => handleUseForPost(item, item.id)}
                              disabled={createPostMutation.isPending}
                              className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                            >
                              <ArrowRight className="w-3 h-3" />
                              Use for Post
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(item.id)}
                              disabled={deleteMutation.isPending}
                              className="flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
