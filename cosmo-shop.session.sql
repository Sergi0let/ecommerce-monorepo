INSERT INTO Brand (
    id,
    name,
    slug,
    createdAt,
    updatedAt,
    logo,
    description,
    websiteUrl,
    metaTitle,
    metaDescription,
    isActive
  )
VALUES (
    'id:text',
    'name:text',
    'slug:text',
    'createdAt:timestamp without time zone',
    'updatedAt:timestamp without time zone',
    'logo:text',
    'description:text',
    'websiteUrl:text',
    'metaTitle:text',
    'metaDescription:text',
    isActive:boolean
  );