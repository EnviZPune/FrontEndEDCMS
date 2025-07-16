import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/categorypanel.css'

// your premade list of names
const PREMADE_CATEGORIES = [
  'T-shirt', 'Boots', 'Jackets', 'Hats', 'Socks',
  'Jeans', 'Shirts', 'Shorts', 'Skirts', 'Dresses'
]

export default function CategoryPanel({ business }) {
  const { get, post, put, del } = useApiClient()
  const [categories, setCategories]           = useState([])
  const [premadeOptions, setPremadeOptions]   = useState(PREMADE_CATEGORIES)
  const [showPremade, setShowPremade]         = useState(false)

  const [newCategory, setNewCategory]         = useState({ name: '' })
  const [editingCategory, setEditingCategory] = useState(null)

  // fetch DB categories + update premade options
  useEffect(() => {
    if (!business?.businessId) return
    fetchCategories()
  }, [business?.businessId])

  async function fetchCategories() {
    try {
      const data = await get(`/api/ClothingCategory/business/${business.businessId}`)
      setCategories(data)
      // remove any premade that already exist in DB
      const existingNames = data.map(c => c.name)
      setPremadeOptions(
        PREMADE_CATEGORIES.filter(name => !existingNames.includes(name))
      )
    } catch (err) {
      console.error('Failed to load categories:', err)
      setCategories([])
      setPremadeOptions(PREMADE_CATEGORIES)
    }
  }

  // add or update a DB category
  const handleSave = async () => {
    const body = {
      businessId: business.businessId,
      name: newCategory.name,
    }
    try {
      if (editingCategory) {
        await put(
          `/api/ClothingCategory/${editingCategory.clothingCategoryId}`,
          body
        )
        alert('Category updated!')
      } else {
        await post('/api/ClothingCategory', body)
        alert('Category added!')
      }
      resetForm()
      fetchCategories()
    } catch (err) {
      console.error('Failed to save category:', err)
      alert('Failed to save category.')
    }
  }

  // delete from DB
  const handleDelete = async (id) => {
    if (!window.confirm('Delete this category?')) return
    try {
      await del(`/api/ClothingCategory/${id}`)
      alert('Category deleted!')
      fetchCategories()
    } catch (err) {
      console.error('Failed to delete category:', err)
      alert('Failed to delete category.')
    }
  }

  // start editing
  const handleEdit = (cat) => {
    setEditingCategory(cat)
    setNewCategory({ name: cat.name })
  }

  // add a premade to DB
  const handleAddPremade = async (name) => {
    try {
      await post('/api/ClothingCategory', {
        businessId: business.businessId,
        name,
      })
      alert(`’${name}’ added!`)
      fetchCategories()
    } catch (err) {
      console.error('Failed to add premade:', err)
      alert('Failed to add premade category.')
    }
  }

  const resetForm = () => {
    setEditingCategory(null)
    setNewCategory({ name: '' })
  }

  return (
    <div className="panel category-panel">
      <h3>Manage Categories</h3>

      {/* toggle between premade vs manual */}
      <label className="toggle-premade">
        <input
          type="checkbox"
          checked={showPremade}
          onChange={e => setShowPremade(e.target.checked)}
        />
        Show premade categories
      </label>

      {showPremade ? (
        // ─── Premade List ────────────────────────────────────────────────
        <ul className="premade-list">
          {premadeOptions.length > 0 ? (
            premadeOptions.map(name => (
              <li key={name}>
                <span className="category-name">{name}</span>
                <button onClick={() => handleAddPremade(name)}>Add</button>
              </li>
            ))
          ) : (
            <li className="no-results">No premade left to add.</li>
          )}
        </ul>
      ) : (
        // ─── Manual / DB List + Form ────────────────────────────────────
        <>
          <ul className="category-list">
            {categories.map(cat => (
              <li key={cat.clothingCategoryId}>
                <span className="category-name">{cat.name}</span>
                <button onClick={() => handleEdit(cat)}>Edit</button>
                <button onClick={() => handleDelete(cat.clothingCategoryId)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <div className="category-form">
            <h4>{editingCategory ? 'Edit' : 'Add'} Category</h4>

            <label htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              type="text"
              value={newCategory.name}
              onChange={e =>
                setNewCategory(nc => ({ ...nc, name: e.target.value }))
              }
            />

            <div className="form-actions">
              <button onClick={handleSave}>
                {editingCategory ? 'Update' : 'Add'} Category
              </button>
              {editingCategory && (
                <button onClick={resetForm} className="cancel">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
