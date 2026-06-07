'use client';

import { useEffect, useState } from "react";
import { getBrandSummaries } from '../lib/api/brands';
import { BrandSummaryType } from '@repo/contracts';

const List = () => {
  const [brands, setBrands] = useState<BrandSummaryType[]>([]);
  useEffect(() => {
    getBrandSummaries().then((data) => {
      setBrands(data);
    });
  }, []);
  return (
    <ul>
      {brands.map((brand) => (
        <li key={brand.id}>{brand.name}</li>
      ))}
    </ul>
  );
};

export default List;