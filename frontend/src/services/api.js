import axios from 'axios'

const client = axios.create({ baseURL: '/api' })

// Search
export const searchBooks = (q, page = 1) => client.get('/search/books', { params: { query: q, page } }).then(r => r.data)
export const searchMovies = (q, page = 1) => client.get('/search/movies', { params: { query: q, page } }).then(r => r.data)
export const getTrendingMovies = (page = 1) => client.get('/search/movies/trending', { params: { page } }).then(r => r.data)

// Library
export const getLibrary = (params) => client.get('/library', { params }).then(r => r.data)
export const saveToLibrary = (item) => client.post('/library', item).then(r => r.data)
export const deleteFromLibrary = (id) => client.delete(`/library/${id}`)

// Posts
export const getPosts = (params) => client.get('/posts', { params }).then(r => r.data)
export const getPost = (id) => client.get(`/posts/${id}`).then(r => r.data)
export const createPost = (data) => client.post('/posts', data).then(r => r.data)
export const updatePost = (id, data) => client.put(`/posts/${id}`, data).then(r => r.data)
export const deletePost = (id) => client.delete(`/posts/${id}`)

// Research
export const getResearchItems = (postId) => client.get('/research', { params: { post_id: postId } }).then(r => r.data)
export const addResearchItem = (data) => client.post('/research', data).then(r => r.data)
export const deleteResearchItem = (id) => client.delete(`/research/${id}`)

// News
export const searchNews = (keywords, page = 1) => client.get('/news/search', { params: { keywords, page } }).then(r => r.data)

// AI
export const generatePost = (data) => client.post('/ai/generate', data).then(r => r.data)

// Image
export const generateImage = (data) => client.post('/image/generate', data).then(r => r.data)

// Settings
export const getSettings = () => client.get('/settings').then(r => r.data)
export const upsertSetting = (key, value) => client.put('/settings', { key, value }).then(r => r.data)
export const deleteSetting = (key) => client.delete(`/settings/${key}`)
