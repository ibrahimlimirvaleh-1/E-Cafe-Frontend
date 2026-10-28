import { formatReservationDateTime } from '../../shared/lib/dateFormatting'
import { i18n } from '../../shared/i18n/i18n'
import type { OrderCancellationRequestResponse } from '../../shared/api/ecafeApi'
import { cancellationRequestLabel, cancellationRequestStatus } from './cancellationRequest'
import './cancellation-request.css'

export function CancellationRequestInfo({ request, timeZone }: { request: OrderCancellationRequestResponse; timeZone?: string }) {
  return <div className="cancellation-request-info" role="status">
    <div className="cancellation-request-info-heading"><strong>{cancellationRequestLabel(request)}</strong><time>{formatReservationDateTime(request.requestedAt, timeZone)}</time></div>
    <p><span>{i18n.t('ui.cancellationRequest.requestReason')}</span>{request.reason}</p>
    {request.decisionReason ? <p><span>{i18n.t('ui.cancellationRequest.decisionReason')}</span>{request.decisionReason}</p> : null}
    {request.forwardedAt ? <small>{i18n.t('ui.cancellationRequest.forwardedAt')} {formatReservationDateTime(request.forwardedAt, timeZone)}</small> : null}
    {request.resolvedAt ? <small>{i18n.t('ui.cancellationRequest.resolvedAt')} {formatReservationDateTime(request.resolvedAt, timeZone)}</small> : null}
    {request.statusId === cancellationRequestStatus.approved && request.stockReturnedAt
      ? <small className="cancellation-request-stock-returned">{i18n.t('ui.partialStockReturn.returnedAt')} {formatReservationDateTime(request.stockReturnedAt, timeZone)}</small> : null}
  </div>
}
