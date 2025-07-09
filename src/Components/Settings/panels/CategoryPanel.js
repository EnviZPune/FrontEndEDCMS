
import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/categorypanel.css'

export default function CategoryPanel({ business }) {
  const { get, post, put, del } = useApiClient()
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState({ name: '', color: '#000000' })
  const [editingCategory, setEditingCategory] = useState(null)

  // Load categories when business changes
  useEffect(() => {
    if (!business) return
    fetchCategories()
  }, [business])

  const fetchCategories = async () => {
    try {
      const data = await get(
        `/api/ClothingCategory/business/${business.businessId}`
      )
      setCategories(data)
    } catch (err) {
      console.error('Failed to load categories:', err)
      setCategories([])
    }
  }

  const handleSave = async () => {
    const body = {
      businessId: business.businessId,
      name: newCategory.name,
      colorHex: newCategory.color,
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
      setNewCategory({ name: '', color: '#000000' })
      setEditingCategory(null)
      fetchCategories()
    } catch (err) {
      console.error('Failed to save category:', err)
      alert('Failed to save category.')
    }
  }

  const handleEdit = (cat) => {
    setEditingCategory(cat)
    setNewCategory({
      name: cat.name,
      color: cat.colorHex || '#000000',
    })
  }

  const handleCancel = () => {
    setEditingCategory(null)
    setNewCategory({ name: '', color: '#000000' })
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category?'))
      return
    try {
      await del(`/api/ClothingCategory/${id}`)
      alert('Category deleted!')
      fetchCategories()
    } catch (err) {
      console.error('Failed to delete category:', err)
      alert('Failed to delete category.')
    }
  }

  return (
    <div className="panel category-panel">
      <h3>Manage Categories</h3>

      <ul className="category-list">
        {categories.map((cat) => (
          <li key={cat.clothingCategoryId}>
            <span
              className="category-color"
              style={{ backgroundColor: cat.colorHex }}
            />
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

        <label>Name</label>
        <input
          type="text"
          value={newCategory.name}
          onChange={(e) =>
            setNewCategory((nc) => ({ ...nc, name: e.target.value }))
          }
        />

        <button onClick={handleSave}>
          {editingCategory ? 'Update' : 'Add'} Category
        </button>
        {editingCategory && (
          <button onClick={handleCancel}>Cancel</button>
        )}
      </div>
    </div>
  )
}
