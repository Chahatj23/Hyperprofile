import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { and, eq, ne } from "drizzle-orm";
import {
  auditLog,
  creators,
  igAccounts,
  pages,
  products,
  reservedSlugs,
  type Db,
  type PageVersion,
} from "@hyperprofile/db";
import { fetchIgReels, type IgMediaItem } from "@hyperprofile/meta";
import { decryptAesGcm } from "@hyperprofile/shared";
import { getSession } from "../auth/session.js";

const DEFAULT_BLOCKS: PageVersion = {
  title: "Welcome to my profile",
  bio: "Creator & Educator",
  theme: {
    accentColor: "#6366f1",
    darkMode: false,
    buttonStyle: "rounded",
  },
  blocks: [
    {
      id: "b_1",
      type: "text",
      title: "Welcome!",
      content: "Check out my latest digital products and resources below.",
      order: 0,
    },
  ],
};

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,28}[a-z0-9])?$/.test(slug);
}

export function registerCreatorRoutes(
  app: FastifyInstance,
  options: { db: Db; sessionSecret: string; tokenEncryptionKey?: string; metaGraphVersion?: string },
) {
  const { db, sessionSecret, tokenEncryptionKey, metaGraphVersion } = options;

  // Helper to ensure authenticated creator
  async function requireCreator(req: FastifyRequest, reply: FastifyReply) {
    const session = getSession(req, sessionSecret);
    if (!session?.creatorId) {
      reply.code(401).send({ code: "unauthorized", message: "Creator login required" });
      return null;
    }
    const creator = (
      await db.select().from(creators).where(eq(creators.id, session.creatorId)).limit(1)
    )[0];
    if (!creator) {
      reply.code(404).send({ code: "creator_not_found", message: "Creator profile not found" });
      return null;
    }
    return { session, creator };
  }

  // Check slug availability
  app.get("/v1/creator/check-slug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.query as { slug?: string };
    if (!slug) return reply.code(400).send({ available: false, error: "Slug is required" });

    const normalized = slug.trim().toLowerCase();
    if (!isValidSlug(normalized)) {
      return { available: false, error: "Slug must be 2-30 lowercase characters with hyphens only" };
    }

    const reserved = (
      await db.select().from(reservedSlugs).where(eq(reservedSlugs.slug, normalized)).limit(1)
    )[0];
    if (reserved) {
      return { available: false, error: "This slug is reserved by system" };
    }

    const existing = (
      await db.select().from(creators).where(eq(creators.slug, normalized)).limit(1)
    )[0];
    return { available: !existing };
  });

  // Update creator profile
  app.put("/v1/creator/profile", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireCreator(req, reply);
    if (!auth) return;

    const body = req.body as {
      displayName?: string;
      bio?: string;
      theme?: Record<string, unknown>;
      slug?: string;
    };

    const updates: Partial<typeof creators.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (body.displayName !== undefined) updates.displayName = body.displayName.trim();
    if (body.bio !== undefined) updates.bio = body.bio.trim();
    if (body.theme !== undefined) updates.theme = body.theme;

    if (body.slug !== undefined) {
      const normalized = body.slug.trim().toLowerCase();
      if (!isValidSlug(normalized)) {
        return reply.code(400).send({ code: "invalid_slug", message: "Invalid slug format" });
      }

      // Check if taken by another creator
      const conflict = (
        await db
          .select()
          .from(creators)
          .where(and(eq(creators.slug, normalized), ne(creators.id, auth.creator.id)))
          .limit(1)
      )[0];
      if (conflict) {
        return reply.code(409).send({ code: "slug_taken", message: "Slug is already taken" });
      }
      updates.slug = normalized;
    }

    const updated = (
      await db.update(creators).set(updates).where(eq(creators.id, auth.creator.id)).returning()
    )[0];

    return { success: true, creator: updated };
  });

  // Get current page builder state (draft + published)
  app.get("/v1/creator/page", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireCreator(req, reply);
    if (!auth) return;

    let pageRow = (
      await db.select().from(pages).where(eq(pages.creatorId, auth.creator.id)).limit(1)
    )[0];

    if (!pageRow) {
      const initialVersion: PageVersion = {
        ...DEFAULT_BLOCKS,
        title: auth.creator.displayName,
        bio: auth.creator.bio ?? "",
      };
      const inserted = await db
        .insert(pages)
        .values({
          creatorId: auth.creator.id,
          draftVersion: initialVersion,
          publishedVersion: initialVersion,
          isPublished: false,
        })
        .returning();
      pageRow = inserted[0]!;
    }

    return {
      id: pageRow.id,
      creatorId: pageRow.creatorId,
      draftVersion: pageRow.draftVersion,
      publishedVersion: pageRow.publishedVersion,
      isPublished: pageRow.isPublished,
      publishedAt: pageRow.publishedAt,
    };
  });

  // Save draft blocks / theme
  app.put("/v1/creator/page/draft", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireCreator(req, reply);
    if (!auth) return;

    const draft = req.body as PageVersion;
    if (!draft || !Array.isArray(draft.blocks)) {
      return reply.code(400).send({ code: "invalid_draft", message: "Blocks array is required" });
    }

    let pageRow = (
      await db.select().from(pages).where(eq(pages.creatorId, auth.creator.id)).limit(1)
    )[0];

    if (!pageRow) {
      pageRow = (
        await db
          .insert(pages)
          .values({
            creatorId: auth.creator.id,
            draftVersion: draft,
            publishedVersion: null,
            isPublished: false,
          })
          .returning()
      )[0]!;
    } else {
      pageRow = (
        await db
          .update(pages)
          .set({ draftVersion: draft, updatedAt: new Date() })
          .where(eq(pages.id, pageRow.id))
          .returning()
      )[0]!;
    }

    return { success: true, draftVersion: pageRow.draftVersion };
  });

  // Publish page: copies draft to publishedVersion, writes audit log
  app.post("/v1/creator/page/publish", async (req: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireCreator(req, reply);
    if (!auth) return;

    const pageRow = (
      await db.select().from(pages).where(eq(pages.creatorId, auth.creator.id)).limit(1)
    )[0];

    if (!pageRow) {
      return reply.code(404).send({ code: "page_not_found", message: "Save draft first before publishing" });
    }

    const before = {
      isPublished: pageRow.isPublished,
      publishedVersion: pageRow.publishedVersion,
    };

    const updated = (
      await db
        .update(pages)
        .set({
          publishedVersion: pageRow.draftVersion,
          isPublished: true,
          publishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(pages.id, pageRow.id))
        .returning()
    )[0]!;

    // Audit log
    await db.insert(auditLog).values({
      actor: `creator:${auth.creator.id}`,
      action: "page.publish",
      entity: `page:${pageRow.id}`,
      before,
      after: { isPublished: true, publishedVersion: updated.publishedVersion },
    });

    return {
      success: true,
      publishedAt: updated.publishedAt,
      slug: auth.creator.slug,
      publishedVersion: updated.publishedVersion,
    };
  });

  // Public endpoint for published page
  app.get("/v1/public/pages/:slug", async (req: FastifyRequest, reply: FastifyReply) => {
    const { slug } = req.params as { slug: string };
    const normalized = slug?.toLowerCase();

    const creator = (
      await db.select().from(creators).where(eq(creators.slug, normalized)).limit(1)
    )[0];

    if (!creator) {
      return reply.code(404).send({ code: "not_found", message: "Creator page not found" });
    }

    const pageRow = (
      await db.select().from(pages).where(eq(pages.creatorId, creator.id)).limit(1)
    )[0];

    // Also fetch active products for this creator to enrich product cards
    const activeProducts = await db
      .select({
        id: products.id,
        type: products.type,
        title: products.title,
        description: products.description,
        pricePaise: products.pricePaise,
        currency: products.currency,
        gstRate: products.gstRate,
      })
      .from(products)
      .where(and(eq(products.creatorId, creator.id), eq(products.status, "active")));

    const published = pageRow?.publishedVersion ?? {
      title: creator.displayName,
      bio: creator.bio ?? "",
      theme: creator.theme,
      blocks: [],
    };

    // Query connected Instagram account for this creator
    let ig = (
      await db.select().from(igAccounts).where(eq(igAccounts.creatorId, creator.id)).limit(1)
    )[0];

    if (!ig && normalized) {
      ig = (
        await db.select().from(igAccounts).where(eq(igAccounts.username, normalized)).limit(1)
      )[0];
    }

    let posts: IgMediaItem[] = [];
    if (ig && tokenEncryptionKey) {
      try {
        const accessToken = decryptAesGcm(ig.accessTokenEncrypted, tokenEncryptionKey);
        posts = await fetchIgReels(ig.igUserId, accessToken, {
          graphVersion: metaGraphVersion || "v21.0",
          mediaLimit: 12,
        });
      } catch {
        // gracefully fall back to empty list on network or Meta Graph error
        posts = [];
      }
    }

    return {
      creator: {
        id: creator.id,
        slug: creator.slug,
        displayName: creator.displayName,
        bio: creator.bio,
        theme: creator.theme,
        plan: creator.plan,
      },
      page: published,
      products: activeProducts,
      isPublished: !!pageRow?.isPublished,
      instagram: ig
        ? {
            username: ig.username,
            igUserId: ig.igUserId,
          }
        : null,
      posts,
    };
  });
}
