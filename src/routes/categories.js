import { Router } from 'express';
import { randomUUID } from 'crypto';
import prisma from '../prisma.js';
import { authRequired, currentUser } from '../middleware/auth.js'; 

const router = Router();

// Apply currentUser middleware to all routes to get user info if available
router.use(currentUser);

// GET all categories
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    const categories = await prisma.categories.findMany({
      select: {
        id: true,
        name: true,
        _count: {
          select: { events: true }
        },
        ...(userId && {
          favoritedByUsers: {
            where: { userId },
            select: { id: true }
          }
        })
      },
      orderBy: {
        name: 'asc',
      },
    });

    const formattedCategories = categories.map(cat => ({
      id: cat.id.toString(),
      name: cat.name,
      eventCount: cat._count.events,
      isFavorite: userId ? (cat.favoritedByUsers?.length > 0) : false
    }));

    res.json(formattedCategories);
  } catch (error) {
    console.error('Get categories error:', error);
    next(error);
  }
});
// GET user's favorite categories
router.get('/favorites/my', authRequired, async (req, res, next) => {
    try {
      const favorites = await prisma.user_favorite_categories.findMany({
        where: { userId: req.user.id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              _count: {
                select: { events: true }
              }
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        }
      });
  
      const formattedFavorites = favorites.map(fav => ({
        id: fav.category.id,
        name: fav.category.name,
        eventCount: fav.category._count.events,
        favoritedAt: fav.createdAt
      }));
  
      res.json(formattedFavorites);
    } catch (error) {
      next(error);
    }
  });

// GET category by ID
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.user?.id;
    
    const category = await prisma.categories.findUnique({
      where: { id: req.params.id },
      include: {
        _count: {
          select: { events: true }
        },
        ...(userId && {
          favoritedByUsers: {
            where: { userId },
            select: { id: true }
          }
        })
      }
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const formattedCategory = {
      ...category,
      eventCount: category._count.events,
      isFavorite: userId ? category.favoritedByUsers?.length > 0 : false,
      _count: undefined,
      favoritedByUsers: undefined
    };

    res.json(formattedCategory);
  } catch (error) {
    next(error);
  }
});



// POST add category to favorites
router.post('/:id/favorite', authRequired, async (req, res, next) => {
  try {
    const { id: categoryId } = req.params;
    const userId = req.user.id;

    // Check if category exists
    const category = await prisma.categories.findUnique({
      where: { id: categoryId }
    });

    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Check if already favorited
    const existing = await prisma.user_favorite_categories.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId
        }
      }
    });

    if (existing) {
      return res.status(400).json({ message: 'Category already in favorites' });
    }

    // Add to favorites
    const favorite = await prisma.user_favorite_categories.create({
      data: {
        id: randomUUID(),
        userId,
        categoryId
      },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Category added to favorites',
      category: favorite.category
    });
  } catch (error) {
    next(error);
  }
});

// DELETE remove category from favorites
router.delete('/:id/favorite', authRequired, async (req, res, next) => {
  try {
    const { id: categoryId } = req.params;
    const userId = req.user.id;

    // Check if favorite exists
    const favorite = await prisma.user_favorite_categories.findUnique({
      where: {
        userId_categoryId: {
          userId,
          categoryId
        }
      }
    });

    if (!favorite) {
      return res.status(404).json({ message: 'Category not in favorites' });
    }

    // Remove from favorites
    await prisma.user_favorite_categories.delete({
      where: {
        userId_categoryId: {
          userId,
          categoryId
        }
      }
    });

    res.json({ message: 'Category removed from favorites' });
  } catch (error) {
    next(error);
  }
});

// PUT update user's favorite categories (replace all)
router.put('/favorites', authRequired, async (req, res, next) => {
  try {
    const { categoryIds } = req.body;
    const userId = req.user.id;

    if (!Array.isArray(categoryIds)) {
      return res.status(400).json({ message: 'categoryIds must be an array' });
    }

    // Verify all categories exist
    const categories = await prisma.categories.findMany({
      where: {
        id: { in: categoryIds }
      }
    });

    if (categories.length !== categoryIds.length) {
      return res.status(400).json({ message: 'One or more categories not found' });
    }

    // Transaction to replace all favorites
    await prisma.$transaction(async (tx) => {
      // Remove all existing favorites
      await tx.user_favorite_categories.deleteMany({
        where: { userId }
      });

      // Add new favorites
      if (categoryIds.length > 0) {
        await tx.user_favorite_categories.createMany({
          data: categoryIds.map(categoryId => ({
            id: randomUUID(),
            userId,
            categoryId
          }))
        });
      }
    });

    // Fetch and return updated favorites
    const updatedFavorites = await prisma.user_favorite_categories.findMany({
      where: { userId },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.json({
      message: 'Favorite categories updated',
      favorites: updatedFavorites.map(f => f.category)
    });
  } catch (error) {
    next(error);
  }
});

export default router;

