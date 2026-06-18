'use client'

import { BrandSummaryType } from '@repo/contracts'
import { useEffect, useState } from 'react'
import { getBrandSummaries } from '../lib/api/brands'

const List = () => {
  const [brands, setBrands] = useState<BrandSummaryType[]>([])
  useEffect(() => {
    getBrandSummaries().then((data) => {
      setBrands(data.data)
    })
  }, [])
  return (
    <ul>
      {brands.map((brand) => (
        <li key={brand.id}>{brand.name}</li>
      ))}
    </ul>
  )
}

export default List
