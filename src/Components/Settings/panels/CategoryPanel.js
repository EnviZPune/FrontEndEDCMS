import React, { useState, useEffect, useMemo } from 'react'
import { FaSearch } from 'react-icons/fa'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/categorypanel.css'

const PREMADE_CATEGORIES = [
  'Ankle Boots',
  'Athletic Shoes',
  'Ballet Flats',
  'Belt',
  'Bandana',
  'Beanie',
  'Bikini',
  'Blazer',
  'Blouse',
  'Bodycon Dress',
  'Bodysuit',
  'Bomb­er Jacket',
  'Boots',
  'Boyfriend Jeans',
  'Bra',
  'Bucket Hat',
  'Caftan',
  'Cardigan',
  'Chelsea Boots',
  'Chinos',
  'Cleats',
  'Cotton Socks',
  'Crop Top',
  'Denim Jacket',
  'Denim Shorts',
  'Dress',
  'Down Jacket',
  'Evening Gown',
  'Flats',
  'Flip Flops',
  'Gloves',
  'Handbag',
  'Hood',
  'Hoodie/Sweatshirt',
  'Jeans',
  'Jumpsuit',
  'Knee-High Boots',
  'Kimono',
  'Leggings',
  'Loafers',
  'Long Sleeve Blouse',
  'Maternity Dress',
  'Mesh Top',
  'Mini Skirt',
  'Moccasins',
  'Mules',
  'Nightshirt',
  'Parka',
  'Peacoat',
  'Pencil Skirt',
  'Polo Shirt',
  'Poncho',
  'Pajamas',
  'Raincoat',
  'Romper',
  'Sandals',
  'Scarf/Shawl',
  'Shawl',
  'Short Shorts',
  'Short Sleeve Blouse',
  'Shorts',
  'Skinny Jeans',
  'Skirt',
  'Slippers',
  'Soccer Jersey',
  'Sports Socks',
  'Sportswear',
  'Stockings',
  'Suspenders',
  'Swimwear',
  'Tank Top',
  'Thongs',
  'Tracksuit',
  'Trench Coat',
  'Trousers',
  'T-shirt',
  'Uniform',
  'Anorak',
  'Blouson Jacket',
  'Cape',
  'Coveralls',
  'Duffle Coat',
  'Flight Jacket',
  'Motorcycle Jacket',
  'Overcoat',
  'Slicker',
  // Bottoms
  'Cargo Pants',
  'Culottes',
  'Dungarees/Overalls',
  'Palazzo Pants',
  'Pea Coat',
  'Tuxedo Pants',  
  // Formal & Tailored
  'Dinner Jacket',
  'Suit',
  'Tailcoat',
  'Tuxedo',
  // Knitwear
  'Fisherman Sweater',
  'Turtleneck',
  // Active & Loungewear
  'Bike Shorts',
  'Board Shorts',
  'Compression Tights',
  'Lounge Set',
  'Rash Guard',
  'Sweatpants',
  // Undergarments
  'Boxer Briefs',
  'Briefs',
  'Corset',
  'Long Johns',
  'Nursing Bra',
  'Sports Bra',
  // Accessories
  'Backpack',
  'Bow Tie',
  'Clutch',
  'Cufflinks',
  'Earrings',
  'Fanny Pack',
  'Messenger Bag',
  'Necklace',
  'Pocket Square',
  'Ring',
  'Satchel',
  'Sunglasses',
  'Tie',
  'Tie Clip',
  'Umbrella',
  'Watch',
  'Undershirt',
  'Vest',
  'Wide Leg Jeans',
  'Wool Qeleshe (Traditional Hat)',
  'Wool Socks',
    'Anorak',
  'Blouson Jacket',
  'Cape',
  'Culottes',
  'Harem Pants',
  'Utility Vest',
  'Windbreaker',
  'Fleece Jacket',
  'Leather Pants',
  'Pleated Skirt',
  'A-Line Skirt',
  'Wrap Dress',
  'Sheath Dress',
  'Fishnet Tights',
  'Leg Warmers',
  'Thermal Underwear',
  'Swim Trunks',
  'Base Layer',
  'Babydoll Dress',
  'Boiler Suit',
  'Capri Pants',
  'Cargo Shorts',
  'Chore Jacket',
  'Cigarette Pants',
  'Duster Coat',
  'Halter Top',
  'Off-the-Shoulder Top',
  'One-Shoulder Top',
  'Peplum Top',
  'Pullover',
  'Shacket',
  'Shirt Dress',
  'Skort',
  'Tunic',
  'Tunic Dress',
  'Bandeau Top',
  'Bolero',
  'Crewneck Sweater',
  'Cropped Jeans',
  'Cropped Pants',
  'Flare Jeans',
  'Bootcut Jeans',
  'Mom Jeans',
  'Sweater Dress',
  'T-Shirt Dress',
  'Swing Dress',
  'Maxi Dress',
  'Pinafore Dress',
  'Paperbag Waist Pants',
  'High-Waisted Pants',
  'Joggers',
  'Utility Jumpsuit',
  'Hoodie',
  'Socks',
  'Underwear',
  'Panties',
  'Coat',
  'Jacket',
  'Sweater',
  'Formal Dresses',
  'Normal Bra',
  'Robes',
  'Swim Suit',
  'Heels',
  'Hats',
  'Caps',
  'Bracelet',
  'Gold',
  'Silver',
  'Button Up Shirts'
]
  .filter((v, i, a) => a.indexOf(v) === i) // dedupe
  .sort((a, b) => a.localeCompare(b, 'en'))

export default function CategoryPanel({ business }) {
  const { get, post, put, del } = useApiClient()

  const [categories, setCategories]           = useState([])
  const [premadeOptions, setPremadeOptions]   = useState(PREMADE_CATEGORIES)
  const [showPremade, setShowPremade]         = useState(false)
  const [premadePage, setPremadePage]         = useState(1)
  const [newCategory, setNewCategory]         = useState({ name: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [searchTerm, setSearchTerm]           = useState('')

  const ITEMS_PER_PAGE = 10

  useEffect(() => {
    fetchCategories()
  }, [business?.businessId])

  async function fetchCategories() {
    if (!business?.businessId) return

    try {
      const data = await get(`/api/ClothingCategory/business/${business.businessId}`)
      setCategories(data)

      const existing = new Set(data.map(c => c.name))
      setPremadeOptions(
        PREMADE_CATEGORIES.filter(name => !existing.has(name))
      )
      setPremadePage(1)
    } catch {
      console.error('Failed to load categories')
      setCategories([])
      setPremadeOptions(PREMADE_CATEGORIES)
      setPremadePage(1)
    }
  }

  const filteredCategories = useMemo(
    () => categories.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    ),
    [categories, searchTerm]
  )
  const filteredPremades = useMemo(
    () => premadeOptions.filter(name =>
      name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    ),
    [premadeOptions, searchTerm]
  )

  const totalPremadePages = Math.ceil(filteredPremades.length / ITEMS_PER_PAGE)
  const currentPremades = filteredPremades.slice(
    (premadePage - 1) * ITEMS_PER_PAGE,
    premadePage * ITEMS_PER_PAGE
  )

  const handleSave = async () => {
    const payload = { businessId: business.businessId, name: newCategory.name.trim() }
    try {
      if (editingCategory) {
        await put(`/api/ClothingCategory/${editingCategory.clothingCategoryId}`, payload)
        alert('Category updated!')
      } else {
        await post('/api/ClothingCategory', payload)
        alert('Category added!')
      }
      resetForm()
      fetchCategories()
    } catch {
      alert('Failed to save category.')
    }
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this category?')) return
    try {
      await del(`/api/ClothingCategory/${id}`)
      alert('Category deleted!')
      fetchCategories()
    } catch {
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
      alert(`'${name}' added!`)
      fetchCategories()
    } catch {
      alert('Failed to add premade category.')
    }
  }

  const resetForm = () => {
    setEditingCategory(null)
    setNewCategory({ name: '' })
  }

  return (
    <div className="category-panel">
      <h3>Category Management Panel</h3>

      <label className="toggle-premade">
        <input
          type="checkbox"
          checked={showPremade}
          onChange={e => {
            setShowPremade(e.target.checked)
            setSearchTerm('')
            setPremadePage(1)
          }}
        />
        Use Premade Categories
      </label>

      <div className="search-box-category">
        <FaSearch className="search-icon-category" />
        <input
          type="text"
          className="search-input-category"
          placeholder="Search categories…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

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
              <li className="no-results">No premade categories found.</li>
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
            {filteredCategories.length > 0 ? (
              filteredCategories.map(cat => (
                <li key={cat.clothingCategoryId}>
                  <span className="category-name">{cat.name}</span>
                  <button onClick={() => handleEdit(cat)}>Edit</button>
                  <button onClick={() => handleDelete(cat.clothingCategoryId)}>
                    Delete
                  </button>
                </li>
              ))
            ) : (
              <li className="no-results">No categories match your search.</li>
            )}
          </ul>

          <div className="category-form">
            <h4>{editingCategory ? 'Update' : 'Create'} Your Own Category</h4>
            <input
              type="text"
              value={newCategory.name}
              onChange={e => setNewCategory({ name: e.target.value })}
              placeholder="Category Name"
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
