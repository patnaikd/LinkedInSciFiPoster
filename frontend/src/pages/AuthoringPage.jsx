import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  PenTool,
  Sparkles,
  Save,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Film,
  Loader2,
  FileText,
  MessageSquare,
  ExternalLink,
  ImageIcon,
  Trash2,
  Check,
} from 'lucide-react';
import {
  getPost,
  getResearchItems,
  generatePost,
  updatePost,
  generateImage,
  suggestImagePrompt,
  selectImage,
  deleteImage,
} from '../services/api';

const TONE_OPTIONS = [
  { value: 'professional_witty', label: 'Professional & Witty' },
  { value: 'thought_leadership', label: 'Thought Leadership' },
  { value: 'casual_fun', label: 'Casual & Fun' },
  { value: 'provocative', label: 'Provocative' },
  { value: 'storytelling', label: 'Storytelling' },
];

export default function AuthoringPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tone, setTone] = useState('professional_witty');
  const [content, setContent] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [contentLoaded, setContentLoaded] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['post', postId],
    queryFn: () => getPost(postId),
    onSuccess: (data) => {
      if (!contentLoaded) {
        if (data.content) setContent(data.content);
        if (data.tone) setTone(data.tone);
        setContentLoaded(true);
      }
    },
  });

  // Handle initial data load via effect-like pattern
  if (post && !contentLoaded) {
    if (post.content) setContent(post.content);
    if (post.tone) setTone(post.tone);
    setContentLoaded(true);
  }

  const { data: researchItems = [] } = useQuery({
    queryKey: ['research', postId],
    queryFn: () => getResearchItems(postId),
  });

  const generateMutation = useMutation({
    mutationFn: generatePost,
    onSuccess: (data) => {
      const generatedContent = data.content || data.generated_content || '';
      setContent(generatedContent);
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Post generated successfully');
    },
    onError: (err) => toast.error(err.message || 'Generation failed'),
  });

  const saveMutation = useMutation({
    mutationFn: ({ id, data }) => updatePost(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Draft saved');
    },
    onError: (err) => toast.error(err.message || 'Failed to save'),
  });

  const imageMutation = useMutation({
    mutationFn: generateImage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Image generated!');
    },
    onError: (err) => toast.error(err.message || 'Image generation failed'),
  });

  const suggestPromptMutation = useMutation({
    mutationFn: () => suggestImagePrompt(postId),
    onSuccess: (data) => {
      setImagePrompt(data.prompt);
      toast.success('Prompt suggested!');
    },
    onError: (err) => toast.error(err.message || 'Failed to suggest prompt'),
  });

  const selectMutation = useMutation({
    mutationFn: (imageId) => selectImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
      toast.success('Image selected for publishing');
    },
    onError: (err) => toast.error(err.message || 'Failed to select image'),
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId) => deleteImage(imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', postId] });
    },
    onError: (err) => toast.error(err.message || 'Failed to delete image'),
  });

  const parseThemes = (themes) => {
    if (Array.isArray(themes)) return themes;
    try {
      return JSON.parse(themes);
    } catch {
      return [];
    }
  };

  const sciFiItem = post?.sci_fi_item;
  const themes = sciFiItem ? parseThemes(sciFiItem.themes) : [];

  // Initialise image prompt when sci-fi item first loads
  useEffect(() => {
    if (!sciFiItem) return;
    const themeStr = themes.length > 0 ? themes.join(', ') : 'science fiction';
    setImagePrompt(
      `${sciFiItem.title} — ${themeStr} — cinematic sci-fi style, dramatic lighting, photorealistic`
    );
  }, [sciFiItem?.id]);

  // Clamp focusedIndex when images array changes (generate adds, delete removes)
  useEffect(() => {
    const len = post?.images?.length ?? 0;
    setFocusedIndex(prev => (len === 0 ? 0 : Math.min(prev, len - 1)));
  }, [post?.images?.length]);

  const images = post?.images ?? [];

  if (postLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
      </div>
    );
  }

  const handleGenerate = () => {
    generateMutation.mutate({
      post_id: parseInt(postId),
      tone,
      additional_instructions: additionalInstructions || undefined,
    });
  };

  const handleSaveDraft = () => {
    saveMutation.mutate({
      id: postId,
      data: { content, tone },
    });
  };

  const handleContinue = () => {
    saveMutation.mutate(
      { id: postId, data: { content, tone } },
      { onSuccess: () => navigate(`/publish/${postId}`) }
    );
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex">
      {/* Collapsible Sidebar */}
      <div
        className={`transition-all duration-300 flex-shrink-0 ${
          sidebarOpen ? 'w-80' : 'w-0'
        } overflow-hidden`}
      >
        <div className="w-80 h-full bg-slate-800 border-r border-slate-700 p-6 overflow-y-auto">
          {/* Sci-Fi Item Info */}
          {sciFiItem && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                {sciFiItem.item_type === 'book' ? (
                  <BookOpen className="w-5 h-5 text-cyan-400" />
                ) : (
                  <Film className="w-5 h-5 text-cyan-400" />
                )}
                Source Material
              </h3>
              {sciFiItem.cover_image_url && (
                <img
                  src={sciFiItem.cover_image_url}
                  alt={sciFiItem.title}
                  className="w-full h-48 object-cover rounded-lg mb-3"
                  onError={(e) => {
                    e.target.style.display = 'none';
                  }}
                />
              )}
              <h4 className="text-white font-medium">{sciFiItem.title}</h4>
              <p className="text-slate-400 text-sm">
                {sciFiItem.author_or_director}
                {sciFiItem.year ? ` (${sciFiItem.year})` : ''}
              </p>
              {themes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {themes.map((theme, i) => (
                    <span
                      key={i}
                      className="bg-cyan-500/10 text-cyan-400 text-xs px-2 py-0.5 rounded-full border border-cyan-500/20"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Research Items */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Research ({researchItems.length})
            </h3>
            {researchItems.length === 0 ? (
              <p className="text-slate-500 text-sm">No research items added.</p>
            ) : (
              <div className="space-y-2">
                {researchItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-slate-900/50 rounded-lg border border-slate-700 p-3"
                  >
                    <h5 className="text-white text-sm font-medium truncate">{item.title}</h5>
                    {item.snippet && (
                      <p className="text-slate-400 text-xs mt-1 line-clamp-2">{item.snippet}</p>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-xs hover:underline flex items-center gap-1 mt-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Source
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sidebar Toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex-shrink-0 w-6 bg-slate-800 border-r border-slate-700 flex items-center justify-center hover:bg-slate-700 transition-colors"
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="max-w-4xl mx-auto w-full px-6 py-8 flex flex-col flex-1">
          <div className="flex items-center gap-3 mb-6">
            <PenTool className="w-8 h-8 text-cyan-400" />
            <h1 className="text-3xl font-bold text-white">Authoring</h1>
          </div>

          {/* Top Bar - Tone & Generate */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-slate-400 text-sm font-medium">Tone:</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm"
                >
                  {TONE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <input
                  type="text"
                  value={additionalInstructions}
                  onChange={(e) => setAdditionalInstructions(e.target.value)}
                  placeholder="Additional instructions (optional)"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm"
                />
              </div>
              <button
                onClick={handleGenerate}
                disabled={generateMutation.isPending}
                className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-medium transition-colors"
              >
                {generateMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {generateMutation.isPending ? 'Generating...' : 'Generate with AI'}
              </button>
            </div>
          </div>

          {/* Content Textarea */}
          <div className="flex-1 flex flex-col mb-6">
            <div className="bg-slate-800 rounded-xl border border-slate-700 flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-slate-300 text-sm font-medium">Post Content</span>
                </div>
                <span
                  className={`text-sm ${
                    content.length > 3000 ? 'text-red-400' : 'text-slate-500'
                  }`}
                >
                  {content.length} / 3,000
                </span>
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Your LinkedIn post content will appear here after generation, or you can start writing..."
                className="flex-1 min-h-[400px] bg-transparent px-4 py-4 text-slate-200 placeholder-slate-500 focus:outline-none resize-none text-base leading-relaxed"
              />
            </div>
          </div>

          {/* Image Generation Section */}
          <div className="bg-slate-800 rounded-xl border border-cyan-500/30 mb-6">
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                <span className="text-slate-300 text-sm font-medium">Post Image</span>
              </div>
              <span className="text-xs text-cyan-500 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                fal.ai
              </span>
            </div>
            <div className="p-4 space-y-3">
              {/* Prompt input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs text-slate-500 uppercase tracking-wide">
                    Image prompt
                  </label>
                  <button
                    onClick={() => suggestPromptMutation.mutate()}
                    disabled={suggestPromptMutation.isPending || !sciFiItem}
                    className="flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 disabled:opacity-40 transition-colors"
                    title={!sciFiItem ? 'Requires a linked sci-fi item' : 'Suggest prompt from articles'}
                  >
                    {suggestPromptMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {suggestPromptMutation.isPending ? 'Suggesting…' : 'Suggest from articles'}
                  </button>
                </div>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder="Describe the image for your post..."
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm leading-relaxed resize-none"
                  rows={3}
                />
              </div>

              {/* Generate button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => imageMutation.mutate({ post_id: parseInt(postId), prompt: imagePrompt })}
                  disabled={imageMutation.isPending || !imagePrompt.trim()}
                  className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-medium transition-colors text-sm"
                >
                  {imageMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {imageMutation.isPending ? 'Generating…' : 'Generate Image'}
                </button>
                {imageMutation.isPending && (
                  <span className="text-slate-500 text-xs">~10–20 seconds</span>
                )}
              </div>

              {/* Carousel */}
              {images.length > 0 ? (
                <div className="pt-2 space-y-3">
                  {/* Image display with prev/next arrows */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setFocusedIndex(prev => Math.max(0, prev - 1))}
                      disabled={focusedIndex === 0}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 transition-colors"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex-1 relative">
                      <img
                        src={`/api/image/${images[focusedIndex].id}`}
                        alt={`Generated image ${focusedIndex + 1}`}
                        className={`w-full h-48 object-cover rounded-lg border-2 transition-all ${
                          images[focusedIndex].is_selected
                            ? 'border-cyan-400'
                            : 'border-slate-700'
                        }`}
                      />
                      {images[focusedIndex].is_selected && (
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-cyan-500 text-white text-xs px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          Selected
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setFocusedIndex(prev => Math.min(images.length - 1, prev + 1))}
                      disabled={focusedIndex === images.length - 1}
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-slate-300 transition-colors"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Dot indicators */}
                  {images.length > 1 && (
                    <div className="flex justify-center gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setFocusedIndex(i)}
                          className={`w-2 h-2 rounded-full transition-colors ${
                            i === focusedIndex ? 'bg-cyan-400' : 'bg-slate-600 hover:bg-slate-500'
                          }`}
                        />
                      ))}
                    </div>
                  )}

                  {/* Action bar */}
                  <div className="flex items-center gap-3">
                    {images[focusedIndex].is_selected ? (
                      <span className="flex items-center gap-1.5 text-cyan-400 text-sm font-medium">
                        <Check className="w-4 h-4" />
                        Selected for publishing
                      </span>
                    ) : (
                      <button
                        onClick={() => selectMutation.mutate(images[focusedIndex].id)}
                        disabled={selectMutation.isPending}
                        className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                      >
                        {selectMutation.isPending ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Use this image
                      </button>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(images[focusedIndex].id)}
                      disabled={deleteMutation.isPending}
                      className="flex items-center gap-1.5 bg-red-900/50 hover:bg-red-800/50 disabled:opacity-50 text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-red-800/50"
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                      Delete
                    </button>
                    <span className="text-slate-600 text-xs ml-auto">
                      {focusedIndex + 1} / {images.length}
                    </span>
                  </div>

                  {/* Download link — only when an image is selected */}
                  {images.some(img => img.is_selected) && (
                    <a
                      href={`/api/image/download/${postId}`}
                      download="post-image.png"
                      className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm transition-colors"
                    >
                      ↓ Download selected image
                    </a>
                  )}
                </div>
              ) : (
                <p className="text-slate-600 text-sm pt-1">No images generated yet.</p>
              )}
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="flex items-center justify-between">
            <button
              onClick={handleSaveDraft}
              disabled={saveMutation.isPending || !content.trim()}
              className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 px-5 py-2.5 rounded-lg font-medium transition-colors"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Draft
            </button>
            <button
              onClick={handleContinue}
              disabled={!content.trim() || content.length > 3000}
              className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-6 py-2.5 rounded-lg font-semibold transition-colors"
            >
              Continue to Publish
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
