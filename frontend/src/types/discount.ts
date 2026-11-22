/**
 * 公開 API の割引。
 * subject と content は、どちらか一方が trim 後に空でなければ null があり得る。
 * createdAt と updatedAt を公開するかは未決定のため、必須にはしない。
 */
export interface Discount {
  id: string
  shopId: string
  subject: string | null
  content: string | null
  startsAt: string | null
  endsAt: string | null
  createdAt?: string
  updatedAt?: string
}
