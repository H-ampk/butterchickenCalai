/**
 * Issue #42 の草案にある割引。
 * 項目名と、startsAt が null のときの意味は未合意。
 * この型は草案に合わせた暫定であり、合意後に合わせる。
 */
export interface Discount {
  id: string
  shopId: string
  subject: string
  content: string
  startsAt: string | null
  endsAt: string | null
  createdAt: string
  updatedAt: string
}
