import React, { useState, useEffect } from 'react'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/categorypanel.css'

const PREMADE_CATEGORIES = [
  'Bandana',
  'Baletkë',
  'Belkë',
  'Bluzë',
  'Bluzë me mëngë të gjata',
  'Bluzë me mëngë të shkurtra',
  'Boxera',
  'Breteshe',
  'Bra',
  'Çanta dore',
  'Çanta shpine',
  'Çizme',
  'Çizme Chelsea',
  'Çizme deri në gju',
  'Çizme shpute',
  'Çorape',
  'Çorape leshi',
  'Çorape pambuku',
  'Çorape sportive',
  'Doreza',
  'Fanellë futbolli',
  'Fustan',
  'Fustan ballo',
  'Fustan dasmë',
  'Fustan folklorik',
  'Fustan maxi',
  'Fustan sundrese',
  'Fustan veror',
  'Jeans/Xhinse',
  'Jeans të ngushta',
  'Jeans të shkurtra',
  'Jelekë',
  'Jelekë izoluese',
  'Kaftan',
  'Kapelë bejsbolli',
  'Kapelë Fedora',
  'Kapelë kovë',
  'Kapelë Panama',
  'Kapuçë',
  'Kardigan',
  'Këmishë',
  'Këmishë elegante',
  'Këmishë nate',
  'Këmishë të brendshme',
  'Këpucë',
  'Këpucë atletike (Atlete)',
  'Këpucë Chelsea',
  'Këpucë me merkuriale',
  'Këpucë pa taka (Flats)',
  'Këpucë sportive',
  'Leggingje',
  'Lingjeri',
  'Loafers',
  'Maikë (Tank-top)',
  'Mokasina',
  'Opinga',
  'Pantallona',
  'Pantallona Chino',
  'Pantallona yoga',
  'Parka',
  'Pantofole',
  'Pizhama',
  'Ponço',
  'Pumpa të larta (Taka)',
  'Pullover',
  'Polo-këmishë',
  'Qeleshë',
  'Qeleshe leshi',
  'Rrip',
  'Rroba banje',
  'Rompër',
  'Salopetë (Jumpsuit)',
  'Sandale',
  'Scarfs/Shall',
  'Shall',
  'Skirtë',
  'Skirtë midi',
  'Shorts',
  'Shorts të shkurtra',
  'Strump/Çorape të holla',
  'Sweatpants/Pantallona triko',
  'Sweatshirts/Hoodies',
  'Tangë',
  'T-Shirt',
  'Trening',
  'Tuta sportive',
  'Uniforma',
  'Veste',
  'Xhaketë bomber',
  'Xhaketë denim',
  'Xhaketë kundër erës',
  'Xhaketë lëkure',
  'Xhaketë me pendë (Down jacket)',
  'Xhaketë puffer'
].sort((a, b) => a.localeCompare(b, 'sq'))

export default function CategoryPanel({ business }) {
  const { get, post, put, del } = useApiClient()

  const [categories, setCategories]         = useState([])
  const [premadeOptions, setPremadeOptions] = useState([])
  const [showPremade, setShowPremade]       = useState(false)
  const [premadePage, setPremadePage]       = useState(1)

  const [newCategory, setNewCategory]       = useState({ name: '' })
  const [editingCategory, setEditingCategory] = useState(null)

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    setPremadeOptions([...PREMADE_CATEGORIES].sort((a, b) =>
      a.localeCompare(b, 'sq')
    ))
  }, [])

  useEffect(() => {
    if (!business?.businessId) return
    fetchCategories()
  }, [business?.businessId])

  async function fetchCategories() {
    try {
      const data = await get(`/api/ClothingCategory/business/${business.businessId}`)
      setCategories(data)

      const existing = new Set(data.map(c => c.name))
      setPremadeOptions(
        PREMADE_CATEGORIES
          .filter(name => !existing.has(name))
          .sort((a, b) => a.localeCompare(b, 'sq'))
      )
      setPremadePage(1)
    } catch (err) {
      console.error('Failed to load categories:', err)
      setCategories([])
      setPremadeOptions([...PREMADE_CATEGORIES].sort((a, b) =>
        a.localeCompare(b, 'sq')
      ))
      setPremadePage(1)
    }
  }

  const handleSave = async () => {
    const body = { businessId: business.businessId, name: newCategory.name.trim() }
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

  const handleDelete = async id => {
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

  const handleEdit = cat => {
    setEditingCategory(cat)
    setNewCategory({ name: cat.name })
  }

  const handleAddPremade = async name => {
    try {
      await post('/api/ClothingCategory', {
        businessId: business.businessId,
        name
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

  const totalPremadePages = Math.ceil(premadeOptions.length / ITEMS_PER_PAGE)
  const startIdx = (premadePage - 1) * ITEMS_PER_PAGE
  const currentPremades = premadeOptions.slice(
    startIdx,
    startIdx + ITEMS_PER_PAGE
  )

  return (
    <div className="category-panel">
      <h3>Category Managment Panel</h3>

      <label className="toggle-premade">
        <input
          type="checkbox"
          checked={showPremade}
          onChange={e => {
            setShowPremade(e.target.checked)
            setPremadePage(1)
          }}
        />
        Use Premade Categories
      </label>

      {showPremade ? (
        <>
          <ul className="premade-list">
            {currentPremades.length > 0 ? (
              currentPremades.map(name => (
                <li key={name}>
                  <span className="category-name">{name}</span>
                  <button onClick={() => handleAddPremade(name)}>Add</button>
                </li>
              ))
            ) : (
              <li className="no-results">There are no categories to add</li>
            )}
          </ul>

          {totalPremadePages > 1 && (
            <div className="premade-pagination">
              <button
                onClick={() => setPremadePage(p => Math.max(p - 1, 1))}
                disabled={premadePage === 1}
              >
                Prev
              </button>
              <span>
                Page {premadePage} of {totalPremadePages}
              </span>
              <button
                onClick={() => setPremadePage(p => Math.min(p + 1, totalPremadePages))}
                disabled={premadePage === totalPremadePages}
              >
                Next
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <ul className="category-list">
            {categories.map(cat => (
              <li key={cat.clothingCategoryId}>
                <span className="category-name">{cat.name}</span>
                <button onClick={() => handleEdit(cat)}>Ndrysho</button>
                <button onClick={() => handleDelete(cat.clothingCategoryId)}>
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <div className="category-form">
            <h4>{editingCategory ? 'Update' : 'Create'} Category</h4>

            <input
              type="text"
              value={newCategory.name}
              onChange={e =>
                setNewCategory(nc => ({ ...nc, name: e.target.value }))
              }
              placeholder="Category Nane"
            />

            <div className="form-actions">
              <button onClick={handleSave}>
                {editingCategory ? 'Update' : 'Create'}
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
