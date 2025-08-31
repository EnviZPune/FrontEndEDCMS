// CategoryPanel.jsx
import React, { useState, useEffect, useMemo } from 'react'
import { FaSearch } from 'react-icons/fa'
import { useTranslation } from 'react-i18next'
import { useApiClient } from '../hooks/useApiClient'
import '../../../Styling/Settings/categorypanel.css'

// Helper to build stable i18n keys from names
const slugify = (s) =>
  (s || '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // strip accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

const PREMADE_CATEGORIES = [
  'Ankle Boots','Athletic Shoes','Ballet Flats','Belt','Bandana','Beanie','Bikini','Blazer','Blouse',
  'Bodycon Dress','Bodysuit','Bomber Jacket','Boots','Boyfriend Jeans','Bra','Bucket Hat','Caftan',
  'Cardigan','Chelsea Boots','Chinos','Cleats','Cotton Socks','Crop Top','Denim Jacket','Denim Shorts',
  'Dress','Down Jacket','Evening Gown','Flats','Flip Flops','Gloves','Handbag','Hood',
  'Hoodie/Sweatshirt','Jeans','Jumpsuit','Knee-High Boots','Kimono','Leggings','Loafers',
  'Long Sleeve Blouse','Maternity Dress','Mesh Top','Mini Skirt','Moccasins','Mules','Nightshirt',
  'Parka','Peacoat','Pencil Skirt','Polo Shirt','Poncho','Pajamas','Raincoat','Romper','Sandals',
  'Scarf/Shawl','Shawl','Short Shorts','Short Sleeve Blouse','Shorts','Skinny Jeans','Skirt','Slippers',
  'Soccer Jersey','Sports Socks','Sportswear','Stockings','Suspenders','Swimwear','Tank Top','Thongs',
  'Tracksuit','Trench Coat','Trousers','T-shirt','Uniform',
  // Outerwear styles
  'Anorak','Blouson Jacket','Cape','Coveralls','Duffle Coat','Flight Jacket','Motorcycle Jacket','Overcoat',
  'Slicker',
  // Bottoms
  'Cargo Pants','Culottes','Dungarees/Overalls','Palazzo Pants','Tuxedo Pants',
  // Formal & Tailored
  'Dinner Jacket','Suit','Tailcoat','Tuxedo',
  // Knitwear
  'Fisherman Sweater','Turtleneck',
  // Active & Loungewear
  'Bike Shorts','Board Shorts','Compression Tights','Lounge Set','Rash Guard','Sweatpants',
  // Undergarments
  'Boxer Briefs','Briefs','Corset','Long Johns','Nursing Bra','Sports Bra',
  // Accessories
  'Backpack','Bow Tie','Clutch','Cufflinks','Earrings','Fanny Pack','Messenger Bag','Necklace',
  'Pocket Square','Ring','Satchel','Sunglasses','Tie','Tie Clip','Umbrella','Watch','Undershirt','Vest',
  // Misc
  'Wide Leg Jeans','Wool Qeleshe (Traditional Hat)','Wool Socks',
  'Harem Pants','Utility Vest','Windbreaker','Fleece Jacket','Leather Pants','Pleated Skirt','A-Line Skirt',
  'Wrap Dress','Sheath Dress','Fishnet Tights','Leg Warmers','Thermal Underwear','Swim Trunks','Base Layer',
  'Babydoll Dress','Boiler Suit','Capri Pants','Cargo Shorts','Chore Jacket','Cigarette Pants','Duster Coat',
  'Halter Top','Off-the-Shoulder Top','One-Shoulder Top','Peplum Top','Pullover','Shacket','Shirt Dress',
  'Skort','Tunic','Tunic Dress','Bandeau Top','Bolero','Crewneck Sweater','Cropped Jeans','Cropped Pants',
  'Flare Jeans','Bootcut Jeans','Mom Jeans','Sweater Dress','T-Shirt Dress','Swing Dress','Maxi Dress',
  'Pinafore Dress','Paperbag Waist Pants','High-Waisted Pants','Joggers','Utility Jumpsuit',
  'Hoodie','Socks','Underwear','Panties','Coat','Jacket','Sweater','Formal Dresses','Normal Bra','Robes',
  'Swim Suit','Heels','Hats','Caps','Bracelet','Gold','Silver','Button Up Shirts'
]
  .filter((v, i, a) => a.indexOf(v) === i)
  .sort((a, b) => a.localeCompare(b, 'en'))

export default function CategoryPanel({ business }) {
  const { t } = useTranslation('categories')
  const { get, post, put, del } = useApiClient()

  const [categories, setCategories] = useState([])
  const [premadeOptions, setPremadeOptions] = useState(PREMADE_CATEGORIES)
  const [showPremade, setShowPremade] = useState(false)
  const [premadePage, setPremadePage] = useState(1)
  const [newCategory, setNewCategory] = useState({ name: '' })
  const [editingCategory, setEditingCategory] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')

  const ITEMS_PER_PAGE = 10

  useEffect(() => { fetchCategories() }, [business?.businessId])

  async function fetchCategories() {
    if (!business?.businessId) return
    try {
      const data = await get(`/api/ClothingCategory/business/${business.businessId}`)
      const list = Array.isArray(data) ? data : []
      setCategories(list)

      const existing = new Set(list.map(c => c.name))
      setPremadeOptions(PREMADE_CATEGORIES.filter(name => !existing.has(name)))
      setPremadePage(1)
    } catch {
      setCategories([])
      setPremadeOptions(PREMADE_CATEGORIES)
      setPremadePage(1)
    }
  }

  // Translate labels via i18n, fallback to the raw name
  const labelFor = (name) => t(`category_names.${slugify(name)}`, { defaultValue: name })

  const filteredCategories = useMemo(
    () => categories.filter(c =>
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase().trim())
    ),
    [categories, searchTerm]
  )
  const filteredPremades = useMemo(
    () => premadeOptions.filter(name =>
      name.toLowerCase().includes(searchTerm.toLowerCase().trim())
    ),
    [premadeOptions, searchTerm]
  )

  const totalPremadePages = Math.ceil(filteredPremades.length / ITEMS_PER_PAGE) || 1
  const currentPremades = filteredPremades.slice(
    (premadePage - 1) * ITEMS_PER_PAGE,
    premadePage * ITEMS_PER_PAGE
  )

  const handleSave = async () => {
    const payload = { businessId: business.businessId, name: newCategory.name.trim() }
    if (!payload.name) return
    try {
      if (editingCategory) {
        await put(`/api/ClothingCategory/${editingCategory.clothingCategoryId}`, payload)
        alert(t('categories.updated', { defaultValue: 'Category updated!' }))
      } else {
        await post('/api/ClothingCategory', payload)
        alert(t('categories.added', { defaultValue: 'Category added!' }))
      }
      resetForm()
      fetchCategories()
    } catch {
      alert(t('categories.save_failed', { defaultValue: 'Failed to save category.' }))
    }
  }

  const handleDelete = async id => {
    if (!window.confirm(t('categories.confirm_delete', { defaultValue: 'Delete this category?' }))) return
    try {
      await del(`/api/ClothingCategory/${id}`)
      alert(t('categories.deleted', { defaultValue: 'Category deleted!' }))
      fetchCategories()
    } catch {
      alert(t('categories.delete_failed', { defaultValue: 'Failed to delete category.' }))
    }
  }

  const handleEdit = cat => {
    setEditingCategory(cat)
    setNewCategory({ name: cat.name })
  }

  const handleAddPremade = async name => {
    // Save canonical English name to the API
    try {
      await post('/api/ClothingCategory', { businessId: business.businessId, name })
      alert(t('categories.premade_added', { defaultValue: `'{{name}}' added!`, name: labelFor(name) }))
      fetchCategories()
    } catch {
      alert(t('categories.premade_add_failed', { defaultValue: 'Failed to add premade category.' }))
    }
  }

  const resetForm = () => {
    setEditingCategory(null)
    setNewCategory({ name: '' })
  }

  return (
    <div className="category-panel">
      <h3>{t('categories.title', { defaultValue: 'Category Management Panel' })}</h3>

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
        {t('categories.use_premade', { defaultValue: 'Use Premade Categories' })}
      </label>

      <div className="search-box-category">
        <FaSearch className="search-icon-category" />
        <input
          type="text"
          className="search-input-category"
          placeholder={t('categories.search_placeholder', { defaultValue: 'Search categories…' })}
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
                  <span className="category-name">{labelFor(name)}</span>
                  <button onClick={() => handleAddPremade(name)}>
                    {t('common.add', { defaultValue: 'Add' })}
                  </button>
                </li>
              ))
            ) : (
              <li className="no-results">
                {t('categories.no_premade', { defaultValue: 'No premade categories found.' })}
              </li>
            )}
          </ul>

          {filteredPremades.length > ITEMS_PER_PAGE && (
            <div className="premade-pagination">
              <button
                onClick={() => setPremadePage(p => Math.max(p - 1, 1))}
                disabled={premadePage === 1}
              >
                {t('common.prev', { defaultValue: 'Prev' })}
              </button>
              <span>
                {t('common.page_of', {
                  defaultValue: 'Page {{page}} of {{total}}',
                  page: premadePage,
                  total: totalPremadePages
                })}
              </span>
              <button
                onClick={() => setPremadePage(p => Math.min(p + 1, totalPremadePages))}
                disabled={premadePage === totalPremadePages}
              >
                {t('common.next', { defaultValue: 'Next' })}
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
                  <span className="category-name">{labelFor(cat.name)}</span>
                  <button onClick={() => handleEdit(cat)}>
                    {t('common.edit', { defaultValue: 'Edit' })}
                  </button>
                  <button onClick={() => handleDelete(cat.clothingCategoryId)}>
                    {t('common.delete', { defaultValue: 'Delete' })}
                  </button>
                </li>
              ))
            ) : (
              <li className="no-results">
                {t('categories.no_match', { defaultValue: 'No categories match your search.' })}
              </li>
            )}
          </ul>

          <div className="category-form">
            <h4>
              {editingCategory
                ? t('categories.update_title', { defaultValue: 'Update Your Own Category' })
                : t('categories.create_title', { defaultValue: 'Create Your Own Category' })}
            </h4>
            <input
              type="text"
              value={newCategory.name}
              onChange={e => setNewCategory({ name: e.target.value })}
              placeholder={t('categories.name_placeholder', { defaultValue: 'Category Name' })}
            />
            <div className="form-actions">
              <button onClick={handleSave}>
                {editingCategory
                  ? t('common.update', { defaultValue: 'Update' })
                  : t('common.create', { defaultValue: 'Create' })}
              </button>
              {editingCategory && (
                <button onClick={resetForm} className="cancel">
                  {t('common.cancel', { defaultValue: 'Cancel' })}
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
