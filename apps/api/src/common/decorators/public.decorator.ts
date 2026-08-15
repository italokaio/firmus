import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marca uma rota como não exigindo access token (ex.: login, registro de empresa). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
