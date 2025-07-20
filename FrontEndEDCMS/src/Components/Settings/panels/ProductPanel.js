// src/Components/Settings/panels/ProductPanel.js
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import { useAuth } from '../hooks/useAuth'
import Pagination from '../../Pagination.tsx'
import '../../../Styling/Settings/productpanel.css'

const SIZE_MAP = { XS: 0, S: 1, M: 2, L: 3, XL: 4, XXL: 5 }
const REV_SIZE_MAP = { 0: 'XS', 1: 'S', 2: 'M', 3: 'L', 4: 'XL', 5: 'XXL' }

export default function ProductPanel({ business }) {
  const { get, post, put, del } = useApiClient()
  const { role }                = useAuth()

  const [products, setProducts]     = useState([])
  const [categories, setCategories] = useState([])
  const [editingId, setEditingId]   = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState({
    name: '', description: '', price: '', quantity: '',
    categoryId: '', brand: '', model: '',
    photos: [], colors: '', size: 'XS', material: '',
  })

  // ─── Pagination state ───────────────────────────────────────────────────────
  const [page, setPage] = useState(1)
  const pageSize = 10

  // reset to first page when products or search changes
  useEffect(() => {
    setPage(1)
  }, [searchQuery, products])

  // ─── Load products & categories once per businessId ────────────────────────
  useEffect(() => {
    const id = business?.businessId
    if (!id) return

    let cancelled = false
    ;(async () => {
      try {
        const [prods, cats] = await Promise.all([
          get(`/api/ClothingItem/business/${id}`),
          get(`/api/ClothingCategory/business/${id}`),
        ])
        if (!cancelled) {
          setProducts(prods)
          setCategories(cats)
        }
      } catch (err) {
        console.error('Load error:', err)
        if (!cancelled) {
          setProducts([])
          setCategories([])
        }
      }
    })()

    return () => { cancelled = true }
  }, [business?.businessId])
  // ────────────────────────────────────────────────────────────────────────────

  // ─── Upload helper ──────────────────────────────────────────────────────────
  const uploadImageToGCS = async (file) => {
    if (!file) return null
    const ts   = Date.now()
    const name = `${ts}-${file.name}`
    const imgUrl = `https://storage.googleapis.com/edcms_bucket/${name}`
    const txtUrl = `${imgUrl}.txt`

    const imgRes = await fetch(imgUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    })
    if (!imgRes.ok) throw new Error('Image upload failed')

    const txtRes = await fetch(txtUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/plain' },
      body: imgUrl,
    })
    if (!txtRes.ok) throw new Error('Text upload failed')

    return imgUrl
  }
  // ────────────────────────────────────────────────────────────────────────────

  const saveProduct = async () => {
    if (!business) return
    const dto = {
      name: form.name,
      businessIds: [business.businessId],
      description: form.description,
      price: parseFloat(form.price) || 0,
      quantity: parseInt(form.quantity, 10) || 0,
      clothingCategoryId: form.categoryId ? +form.categoryId : null,
      brand: form.brand,
      model: form.model,
      pictureUrls: form.photos,
      colors: form.colors.split(',').map(s => s.trim()),
      sizes: SIZE_MAP[form.size] ?? 0,
      material: form.material,
    }

    try {
      if (role === 'employee') {
        await post('/api/ProposedChanges/submit', {
          businessId: business.businessId,
          type: editingId ? 'Update' : 'Create',
          itemDto: { ...dto, clothingItemId: editingId || 0 },
        })
        alert('Your change has been proposed.')
      } else {
        if (editingId) await put(`/api/ClothingItem/${editingId}`, dto)
        else await post('/api/ClothingItem', dto)
        alert('Product saved!')
        const updated = await get(`/api/ClothingItem/business/${business.businessId}`)
        setProducts(updated)
      }
    } catch (err) {
      console.error('Save error:', err)
      alert('Failed to save product.')
    }

    setEditingId(null)
    setForm({
      name: '', description: '', price: '', quantity: '',
      categoryId: '', brand: '', model: '',
      photos: [], colors: '', size: 'XS', material: '',
    })
  }

  const handleDelete = async (id) => {
    if (!business) return

    if (role === 'employee') {
      if (!window.confirm('Submit delete request?')) return
      const orig = products.find(p => p.clothingItemId === id) || {}
      await post('/api/ProposedChanges/submit', {
        businessId: business.businessId,
        type: 'Delete',
        itemDto: {
          clothingItemId: id,
          name: orig.name || '',
          businessIds: orig.businessIds?.length
            ? orig.businessIds
            : [business.businessId],
        },
      })
      alert('Delete request submitted.')
    } else {
      if (!window.confirm('Permanently delete this product?')) return
      try {
        await del(`/api/ClothingItem/${id}`)
        alert('Product deleted.')
        const updated = await get(`/api/ClothingItem/business/${business.businessId}`)
        setProducts(updated)
      } catch (err) {
        console.error('Delete error:', err)
        alert('Failed to delete product.')
      }
    }
  }

  const startEdit = (p) => {
    setEditingId(p.clothingItemId)
    setForm({
      name: p.name,
      description: p.description,
      price: p.price.toString(),
      quantity: p.quantity.toString(),
      categoryId: p.clothingCategoryId || '',
      brand: p.brand,
      model: p.model,
      photos: p.pictureUrls || [],
      colors: Array.isArray(p.colors) ? p.colors.join(', ') : p.colors || '',
      size: REV_SIZE_MAP[p.sizes] || 'XS',
      material: p.material,
    })
  }

  // ─── Filter + paginate ─────────────────────────────────────────────────────
  const filtered = products.filter(p =>
    [p.name, p.brand, p.model, p.description]
      .join(' ')
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )
  const totalCount = filtered.length
  const startIdx   = (page - 1) * pageSize
  const paginated  = filtered.slice(startIdx, startIdx + pageSize)
  // ────────────────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="panel product-form">
        <h3>{editingId ? 'Edit Product' : 'Add New Product'}</h3>

        <div className="grid two-cols">
          <input
            placeholder="Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          />
          <input
            placeholder="Brand"
            value={form.brand}
            onChange={e => setForm(f => ({ ...f, brand: e.target.value }))}
          />
        </div>

        <div className="grid two-cols">
          <input
            placeholder="Model"
            value={form.model}
            onChange={e => setForm(f => ({ ...f, model: e.target.value }))}
          />
          <input
            type="number"
            placeholder="Price"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
          />
        </div>

        <textarea
          placeholder="Description"
          value={form.description}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
        />

        <div className="grid three-cols">
          <input
            type="number"
            placeholder="Quantity"
            value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
          />
          <select
            value={form.categoryId}
            onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}
          >
            <option value="">Category…</option>
            {categories.map(c => (
              <option key={c.clothingCategoryId} value={c.clothingCategoryId}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={form.size}
            onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
          >
            {Object.keys(SIZE_MAP).map(sz => (
              <option key={sz} value={sz}>{sz}</option>
            ))}
          </select>
        </div>

        <div className="grid two-cols">
          <input
            placeholder="Colors (comma separated)"
            value={form.colors}
            onChange={e => setForm(f => ({ ...f, colors: e.target.value }))}
          />
          <input
            placeholder="Material"
            value={form.material}
            onChange={e => setForm(f => ({ ...f, material: e.target.value }))}
          />
        </div>
        <br></br>
            
        <label className="file-btn">
          Upload Some Pictures
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={async e => {
              let curr = [...form.photos]
              for (let file of Array.from(e.target.files)) {
                if (curr.length >= 10) break
                const url = await uploadImageToGCS(file)
                if (url) curr.push(url)
              }
              setForm(f => ({ ...f, photos: curr }))
            }}
          />
        </label>

        <div className="photo-row">
          {form.photos.map((url, i) => (
            <div key={i} className="thumb">
              <img src={url} alt="" />
              <button onClick={() =>
                setForm(f => ({ ...f, photos: f.photos.filter((_, idx) => idx !== i) }))
              }>×</button>
            </div>
          ))}
        </div>

        <div className="actions">
          <button onClick={saveProduct}>{editingId ? 'Save' : 'Add'}</button>
          {editingId && (
            <button onClick={() => {
              setEditingId(null)
              setForm({
                name: '', description: '', price: '', quantity: '',
                categoryId: '', brand: '', model: '',
                photos: [], colors: '', size: 'XS', material: '',
              })
            }} className="cancel">Cancel</button>
          )}
        </div>
      </div>

      <div className="panel product-list">
        <h3>Products</h3>
        <input
          className="search"
          type="text"
          placeholder="Search…"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />

        <ul>
          {paginated.length > 0 ? paginated.map(p => (
            <li key={p.clothingItemId}>
              <span>{p.name} – {p.model} (${p.price})</span>
              <div className="btns">
                <button onClick={() => startEdit(p)}>Edit</button>
                <button onClick={() => handleDelete(p.clothingItemId)}>Delete</button>
              </div>
            </li>
          )) : (
            <li className="no-results">No products match.</li>
          )}
        </ul>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          maxButtons={5}
        />
      </div>
    </>
  )
}
