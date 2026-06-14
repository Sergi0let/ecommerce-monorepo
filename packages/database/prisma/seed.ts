import { prisma } from '../src/client.js'

async function main() {
  console.log('🌱 Сіємо тестові дані косметики...')

  // 1. Дефолтний склад
  const defaultWarehouse = await prisma.warehouse.upsert({
    where: { code: 'DEFAULT_001' },
    update: {},
    create: {
      name: 'Основний логістичний центр',
      code: 'DEFAULT_001',
      address: 'Київ, вул. Логістична, 10',
      isDefault: true,
      isActive: true,
    },
  })
  console.log('✅ Склад готовий')

  // 2. Бренди
  const [instytutum, medik8] = await Promise.all([
    prisma.brand.upsert({
      where: { slug: 'instytutum' },
      update: {},
      create: {
        name: 'Instytutum',
        slug: 'instytutum',
        description:
          "Інноваційна космецевтика для здоров'я та довголіття шкіри.",
        logo: 'https://instytutum.ua/logo.png',
        websiteUrl: 'https://instytutum.ua',
        metaTitle: 'Instytutum | Професійний догляд',
        isActive: true,
      },
    }),
    prisma.brand.upsert({
      where: { slug: 'medik8' },
      update: {},
      create: {
        name: 'Medik8',
        slug: 'medik8',
        description:
          'Британська космецевтика з науковим підходом до антивікового догляду.',
        logo: 'https://medik8.ua/logo.png',
        websiteUrl: 'https://medik8.ua',
        metaTitle: 'Medik8 | Науково обґрунтований догляд',
        isActive: true,
      },
    }),
  ])
  console.log('✅ Бренди створено')

  // 3. Категорії
  const categoriesData = [
    {
      name: 'Сироватки та олії',
      slug: 'serums-oils',
      metaTitle: 'Сироватки та олії',
    },
    {
      name: 'Креми та догляд',
      slug: 'creams-care',
      metaTitle: 'Креми та догляд',
    },
    {
      name: 'Ретиноїди',
      slug: 'retinoids',
      metaTitle: 'Ретиноїди',
    },
    {
      name: 'Пептиди та вітамін С',
      slug: 'peptides-vitamin-c',
      metaTitle: 'Пептиди та вітамін С',
    },
  ]

  const categories = await Promise.all(
    categoriesData.map((cat) =>
      prisma.category.upsert({
        where: { slug: cat.slug },
        update: {},
        create: cat,
      }),
    ),
  )
  console.log('✅ Категорії створено')

  // 4. Атрибути
  console.log('🏷️ Створюю атрибути...')

  await prisma.attribute.upsert({
    where: { code: 'skin_type' },
    update: {},
    create: {
      code: 'skin_type',
      name: 'Тип шкіри',
      type: 'MULTI',
      values: {
        create: [
          { value: 'normal', label: 'Нормальна' },
          { value: 'dry', label: 'Суха' },
          { value: 'oily', label: 'Жирна' },
          { value: 'combination', label: 'Комбінована' },
        ],
      },
    },
  })

  await prisma.attribute.upsert({
    where: { code: 'concern' },
    update: {},
    create: {
      code: 'concern',
      name: 'Проблеми шкіри',
      type: 'MULTI',
      values: {
        create: [
          { value: 'acne', label: 'Акне' },
          { value: 'wrinkles', label: 'Зморшки' },
          { value: 'dryness', label: 'Сухість' },
          { value: 'pigmentation', label: 'Пігментація' },
          { value: 'dehydration', label: 'Зневоднення' },
        ],
      },
    },
  })

  console.log('✅ Атрибути створено')

  // 5. Інгредієнти
  console.log('🧪 Створюю інгредієнти...')

  const ingredients = await Promise.all([
    prisma.ingredient.upsert({
      where: { slug: 'hyaluronic-acid' },
      update: {},
      create: {
        name: 'Гіалуронова кислота',
        slug: 'hyaluronic-acid',
        inciName: 'Sodium Hyaluronate',
        description: 'Потужний зволожувач, який утримує вологу в шкірі',
        comedogenicRating: 0,
        safetyScore: 9.5,
        benefits: ['Зволоження', 'Пружність', 'Розгладжування'],
      },
    }),
    prisma.ingredient.upsert({
      where: { slug: 'vitamin-c' },
      update: {},
      create: {
        name: 'Вітамін С',
        slug: 'vitamin-c',
        inciName: 'Ascorbic Acid',
        description:
          'Антиоксидант, який освітлює шкіру та стимулює вироблення колагену',
        comedogenicRating: 0,
        safetyScore: 9.0,
        benefits: ['Освітлення', 'Антиоксидант', 'Колаген'],
      },
    }),
    prisma.ingredient.upsert({
      where: { slug: 'retinol' },
      update: {},
      create: {
        name: 'Ретинол',
        slug: 'retinol',
        inciName: 'Retinol',
        description: 'Вітамін А для оновлення клітин та боротьби зі зморшками',
        comedogenicRating: 1,
        safetyScore: 8.0,
        benefits: ['Оновлення', 'Зменшення зморшок', 'Текстура'],
        restrictions: ['Не використовувати під час вагітності'],
      },
    }),
    prisma.ingredient.upsert({
      where: { slug: 'niacinamide' },
      update: {},
      create: {
        name: 'Ніацинамід',
        slug: 'niacinamide',
        inciName: 'Niacinamide',
        description: "Вітамін В3 для зміцнення бар'єру шкіри та звуження пор",
        comedogenicRating: 0,
        safetyScore: 10.0,
        benefits: ['Звуження пор', 'Контроль жирності', "Зміцнення бар'єру"],
      },
    }),
    prisma.ingredient.upsert({
      where: { slug: 'peptides' },
      update: {},
      create: {
        name: 'Пептиди',
        slug: 'peptides',
        inciName: 'Palmitoyl Pentapeptide',
        description: 'Будівельні блоки для колагену та еластину',
        comedogenicRating: 0,
        safetyScore: 9.5,
        benefits: ['Ліфтинг', 'Пружність', 'Розгладжування'],
      },
    }),
  ])
  console.log('✅ Інгредієнти створено')

  // 6. Продукти
  const productsData = [
    // Instytutum - Сироватки та олії
    {
      name: 'Cryoshot Hydrating Serum Classic',
      slug: 'cryoshot-hydrating-serum',
      description: 'Гідратуюча сироватка для миттєвого зволоження та сяйва.',
      volumeMl: 30,
      priceCents: 55000,
      brandId: instytutum.id,
      categoryId: categories?.[0]?.id,
      isActive: true,
    },
    {
      name: 'Brightening Vitamin C Serum Next-Gen',
      slug: 'brightening-vitamin-c-serum',
      description: 'Освітлювальна сироватка з вітаміном С нового покоління.',
      volumeMl: 30,
      priceCents: 59500,
      brandId: instytutum.id,
      categoryId: categories?.[0]?.id,
      isActive: true,
    },
    {
      name: 'Powerful RetinOil Next-Gen',
      slug: 'powerful-retinoil',
      description: 'Олія з ретинолом для оновлення та пружності шкіри.',
      volumeMl: 30,
      priceCents: 43000,
      brandId: instytutum.id,
      categoryId: categories?.[0]?.id,
      isActive: true,
    },
    {
      name: 'X-strength Retinol Serum Next-Gen',
      slug: 'x-strength-retinol',
      description:
        'Інтенсивна сироватка з ретинолом для досвідчених користувачів.',
      volumeMl: 30,
      priceCents: 59500,
      brandId: instytutum.id,
      categoryId: categories?.[0]?.id,
      isActive: true,
    },
    {
      name: 'Advanced Retinol Toner Next-Gen',
      slug: 'advanced-retinol-toner',
      description:
        'Тонер з ретинолом для підготовки шкіри до подальшого догляду.',
      volumeMl: 200,
      priceCents: 29000,
      brandId: instytutum.id,
      categoryId: categories?.[0]?.id,
      isActive: true,
    },

    // Instytutum - Креми та догляд
    {
      name: 'HydraFusion Hydrating Gel Cream Next-Gen',
      slug: 'hydrafusion-gel-cream',
      description: 'Легкий гель-крем для інтенсивного зволоження.',
      weightG: 50,
      priceCents: 42000,
      brandId: instytutum.id,
      categoryId: categories?.[1]?.id,
      isActive: true,
    },
    {
      name: 'Xceptional Flawless Cream Next-Gen',
      slug: 'xceptional-flawless-cream',
      description: 'Крем для досконалого тону та рельєфу шкіри.',
      weightG: 50,
      priceCents: 59500,
      brandId: instytutum.id,
      categoryId: categories?.[1]?.id,
      isActive: true,
    },
    {
      name: 'SuperBiotic Regenerating Cream Next-Gen',
      slug: 'superbiotic-cream',
      description: 'Відновлювальний крем з пробіотиками.',
      weightG: 50,
      priceCents: 42000,
      brandId: instytutum.id,
      categoryId: categories?.[1]?.id,
      isActive: true,
    },
    {
      name: 'Adaptogel Cleanser Next-Gen',
      slug: 'adaptogel-cleanser',
      description: "Адаптогель для м'якого очищення.",
      volumeMl: 150,
      priceCents: 22000,
      brandId: instytutum.id,
      categoryId: categories?.[1]?.id,
      isActive: true,
    },
    {
      name: 'Resurfacing Glow Toner Next-Gen',
      slug: 'resurfacing-glow-toner',
      description: 'Оновлюючий тонер для сяйва.',
      volumeMl: 200,
      priceCents: 29000,
      brandId: instytutum.id,
      categoryId: categories?.[1]?.id,
      isActive: true,
    },

    // Medik8 - Ретиноїди
    {
      name: 'Crystal Retinal 1',
      slug: 'crystal-retinal-1',
      description: '0,01% ретиналь. Для чутливої шкіри та початківців.',
      volumeMl: 30,
      priceCents: 28000,
      brandId: medik8.id,
      categoryId: categories?.[2]?.id,
      isActive: true,
    },
    {
      name: 'Crystal Retinal 3',
      slug: 'crystal-retinal-3',
      description: '0,03% ретиналь. Ідеальний стартовий концентрат.',
      volumeMl: 30,
      priceCents: 32500,
      brandId: medik8.id,
      categoryId: categories?.[2]?.id,
      isActive: true,
    },
    {
      name: 'Crystal Retinal 6',
      slug: 'crystal-retinal-6',
      description: '0,06% ретиналь. Для видимих антивікових результатів.',
      volumeMl: 30,
      priceCents: 43000,
      brandId: medik8.id,
      categoryId: categories?.[2]?.id,
      isActive: true,
    },
    {
      name: 'Crystal Retinal 10',
      slug: 'crystal-retinal-10',
      description: '0,1% ретиналь. Для просунутих користувачів.',
      volumeMl: 30,
      priceCents: 55000,
      brandId: medik8.id,
      categoryId: categories?.[2]?.id,
      isActive: true,
    },
    {
      name: 'Intelligent Retinol 6TR™',
      slug: 'intelligent-retinol-6tr',
      description: '0,6% інтелектуальний ретинол з пролонгованою дією.',
      volumeMl: 30,
      priceCents: 32000,
      brandId: medik8.id,
      categoryId: categories?.[2]?.id,
      isActive: true,
    },

    // Medik8 - Пептиди та вітамін С
    {
      name: 'Liquid Peptides Advanced MP',
      slug: 'liquid-peptides-advanced',
      description: 'Сироватка з Dual MiniProteins™ для боротьби зі старінням.',
      volumeMl: 30,
      priceCents: 50000,
      brandId: medik8.id,
      categoryId: categories?.[3]?.id,
      isActive: true,
    },
    {
      name: 'Advanced Pro-Collagen+ Peptide Cream™',
      slug: 'pro-collagen-peptide-cream',
      description: 'Омолоджуючий крем з MiniProtein™ та NAD+.',
      weightG: 50,
      priceCents: 50000,
      brandId: medik8.id,
      categoryId: categories?.[3]?.id,
      isActive: true,
    },
    {
      name: 'C-Tetra Advanced',
      slug: 'c-tetra-advanced',
      description: 'Гель-сироватка з 20% вітаміном С та фітоекзосомами.',
      volumeMl: 30,
      priceCents: 42500,
      brandId: medik8.id,
      categoryId: categories?.[3]?.id,
      isActive: true,
    },
    {
      name: 'Niacinamide Peptides',
      slug: 'niacinamide-peptides',
      description: 'Сироватка з 10% ніацинамідом та пептидами.',
      volumeMl: 30,
      priceCents: 32000,
      brandId: medik8.id,
      categoryId: categories?.[3]?.id,
      isActive: true,
    },
    {
      name: 'Super C Ferulic™',
      slug: 'super-c-ferulic',
      description:
        'Потужна сироватка для освітлення та захисту від гіперпігментації.',
      volumeMl: 30,
      priceCents: 42500,
      brandId: medik8.id,
      categoryId: categories?.[3]?.id,
      isActive: true,
    },
  ]

  console.log('🏭 Створюю товари...')

  for (const p of productsData) {
    const product = await prisma.product.create({
      data: {
        name: p.name,
        slug: p.slug,
        description: p.description,
        volumeMl: p.volumeMl,
        weightG: p.weightG,
        isActive: p.isActive,
        brandId: p.brandId,
        categoryId: p.categoryId,
        prices: {
          create: {
            amountCents: p.priceCents,
            currency: 'UAH',
            isValidFrom: new Date(),
          },
        },
        inventory: {
          create: {
            warehouseId: defaultWarehouse.id,
            quantity: 100,
            reserved: 0,
          },
        },
        images: {
          create: [
            {
              url: `https://placehold.co/600x600?text=${p.slug}+1`,
              alt: p.name,
              sortOrder: 0,
              isPrimary: true,
            },
            {
              url: `https://placehold.co/600x600?text=${p.slug}+2`,
              alt: p.name,
              sortOrder: 1,
              isPrimary: false,
            },
          ],
        },
      },
    })
    console.log(`   ✓ ${product.name}`)
  }

  console.log('🎉 Готово! База наповнена тестовими даними.')
}

main()
  .catch((e) => {
    console.error('❌ Помилка сіду:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
