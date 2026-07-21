import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, ListGroup, Row } from 'react-bootstrap';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { listCardTypes } from '../../api/admin';
import { createCustomer, searchCustomersByPhone } from '../../api/customers';
import { createOrder } from '../../api/orders';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatCurrency } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';
import { useToast } from '../../hooks/useToast.jsx';
import { TIME_SLOTS } from '../../utils/constants.js';
import { normalizeVietnamesePhone, optionalEmailRule, vietnamesePhoneRule } from '../../utils/validation.js';

const steps = ['Khách hàng', 'Thông tin đơn', 'Xác nhận'];

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const lichHenId = searchParams.get('lich_hen_id');
  const [step, setStep] = useState(0);
  const [so_dien_thoai, setPhone] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ ho_ten: '', so_dien_thoai: '', email: '', ghi_chu: '' });
  const [dupCandidates, setDupCandidates] = useState(null);
  const [orderForm, setOrderForm] = useState({
    loai_the_id: '',
    so_luong: 4,
    ngay_hen_lay: '',
    khung_gio_lay: '',
    ghi_chu: '',
    hinh_thuc_giao: 'lay_hinh_ngay'
  });
  const searchErrors = useFormErrors();
  const customerErrors = useFormErrors();
  const [stepError, setStepError] = useState('');
  const toast = useToast();

  const cardTypesQuery = useQuery({
    queryKey: ['card-types'],
    queryFn: listCardTypes
  });

  const searchMutation = useMutation({
    mutationFn: searchCustomersByPhone,
    onSuccess: (result) => {
      setCustomers(result);
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: ({ customer }) => {
      setDupCandidates(null);
      setSelectedCustomer(customer);
      setCustomers([customer]);
      setStep(1);
    }
  });

  // Cảnh báo mềm: trước khi tạo khách, kiểm tra SĐT đã tồn tại chưa.
  // Có trùng -> hiện danh sách khách sẵn có để chọn; không có -> tạo luôn.
  const dupCheckMutation = useMutation({
    mutationFn: searchCustomersByPhone,
    onSuccess: (existing) => {
      if (existing.length > 0) {
        setDupCandidates(existing);
      } else {
        createCustomerMutation.mutate(customerForm);
      }
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: ({ order }) => {
      navigate(`/staff/orders/${order.id}`);
      toast.success('Đã tạo đơn hàng');
    }
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const selectedCardType = cardTypes.find((cardType) => cardType.id === orderForm.loai_the_id);
  const isOnlineFileDelivery = orderForm.hinh_thuc_giao === 'lay_file_truc_tuyen';
  const onlineFilePrice = cardTypesQuery.data?.gia_file_truc_tuyen_hien_hanh;
  const hasOnlineFilePrice = onlineFilePrice !== null && onlineFilePrice !== undefined;
  const estimatedTotal = useMemo(() => {
    if (!selectedCardType) return 0;
    if (isOnlineFileDelivery) return Number(onlineFilePrice || 0);
    return Number(selectedCardType.gia_moi_ban_hien_hanh || 0) * Number(orderForm.so_luong || 0)
      + Number(selectedCardType.phi_xu_ly_hien_hanh || 0);
  }, [isOnlineFileDelivery, onlineFilePrice, orderForm.so_luong, selectedCardType]);

  function handleSearch(event) {
    event.preventDefault();
    if (!searchErrors.validate({ so_dien_thoai }, { so_dien_thoai: vietnamesePhoneRule })) return;
    const value = normalizeVietnamesePhone(so_dien_thoai);
    setSelectedCustomer(null);
    setCustomers([]);
    setDupCandidates(null);
    setCustomerForm((current) => ({ ...current, so_dien_thoai: value }));
    searchMutation.mutate(value);
  }

  function submitCustomer(event) {
    event.preventDefault();
    if (!customerErrors.validate(customerForm, {
      ho_ten: 'Vui lòng nhập họ tên',
      so_dien_thoai: vietnamesePhoneRule,
      email: optionalEmailRule
    })) return;
    setDupCandidates(null);
    dupCheckMutation.mutate(normalizeVietnamesePhone(customerForm.so_dien_thoai));
  }

  function forceCreateCustomer() {
    createCustomerMutation.mutate(customerForm);
  }

  function selectCustomer(customer) {
    setDupCandidates(null);
    setSelectedCustomer(customer);
    setCustomers([customer]);
    setStep(1);
  }

  function goToConfirm() {
    if (!selectedCardType) {
      setStepError('Vui lòng chọn một loại thẻ.');
      return;
    }
    if (isOnlineFileDelivery && !hasOnlineFilePrice) {
      setStepError('Tiệm chưa cấu hình giá file trực tuyến. Vui lòng liên hệ Admin.');
      return;
    }
    if (!isOnlineFileDelivery && Number(orderForm.so_luong) < 4) {
      setStepError('Số lượng tối thiểu là 4 tấm/đơn.');
      return;
    }
    if (orderForm.hinh_thuc_giao === 'hen_lay_hinh' && (!orderForm.ngay_hen_lay || !orderForm.khung_gio_lay)) {
      setStepError('Vui lòng chọn ngày và khung giờ lấy hình.');
      return;
    }
    setStepError('');
    setStep(2);
  }

  function submitOrder() {
    if (!selectedCustomer || !selectedCardType) return;
    const payload = {
      khach_hang_id: selectedCustomer.id,
      loai_the_id: selectedCardType.id,
      ngay_hen_lay: orderForm.hinh_thuc_giao === 'hen_lay_hinh' ? orderForm.ngay_hen_lay || undefined : undefined,
      khung_gio_lay: orderForm.hinh_thuc_giao === 'hen_lay_hinh' ? orderForm.khung_gio_lay || undefined : undefined,
      ghi_chu: orderForm.ghi_chu || undefined,
      lich_hen_id: lichHenId || undefined,
      hinh_thuc_giao: orderForm.hinh_thuc_giao
    };
    if (!isOnlineFileDelivery) payload.so_luong = Number(orderForm.so_luong);
    createOrderMutation.mutate(payload);
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Tạo đơn mới</h1>
          <p>Tìm khách, chọn loại thẻ, xác nhận giá tạm tính.</p>
        </div>
      </div>

      <div className="wizard-steps">
        {steps.map((label, index) => (
          <button
            type="button"
            key={label}
            className={`wizard-step ${index === step ? 'active' : ''} ${index < step ? 'done' : ''}`}
            onClick={() => index <= step && setStep(index)}
          >
            <span>{index < step ? <Check size={15} /> : index + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <div className="d-grid gap-3">
          <section className="app-panel">
            <h2>Tìm khách bằng SĐT</h2>
            <Form onSubmit={handleSearch}>
              <div className="d-flex align-items-stretch gap-3">
                <Form.Control
                  className="flex-grow-1"
                  value={so_dien_thoai}
                  onChange={(event) => {
                    setPhone(event.target.value);
                    setCustomers([]);
                    setSelectedCustomer(null);
                    setDupCandidates(null);
                    searchMutation.reset();
                    searchErrors.clearError('so_dien_thoai');
                  }}
                  placeholder="Nhập số điện thoại"
                  isInvalid={!!searchErrors.errors.so_dien_thoai}
                />
                <Button type="submit" className="button-nowrap" disabled={searchMutation.isPending}>
                  <Search size={17} aria-hidden="true" />
                  Tìm
                </Button>
              </div>
              {searchErrors.errors.so_dien_thoai ? <div className="invalid-feedback d-block">{searchErrors.errors.so_dien_thoai}</div> : null}
            </Form>
            {searchMutation.isPending ? <LoadingState label="Đang tìm khách..." /> : null}
            {searchMutation.error ? (
              <Alert variant="warning" className="mt-3 mb-0">Không tìm được khách. Vui lòng kiểm tra lại số điện thoại.</Alert>
            ) : null}
            {customers.length > 0 ? (
              <ListGroup className="selection-list mt-3" aria-label="Kết quả tìm khách">
                {customers.map((customer) => (
                  <ListGroup.Item key={customer.id} action onClick={() => selectCustomer(customer)}>
                    <div className="fw-semibold">{customer.ho_ten}</div>
                    <div className="small">{customer.so_dien_thoai}</div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            ) : null}
          </section>

          <section className="app-panel">
            <h2>Thêm khách mới</h2>
            <Form onSubmit={submitCustomer}>
              <div className="d-grid gap-3">
                <Form.Group>
                  <Form.Label>Họ tên</Form.Label>
                  <Form.Control
                    value={customerForm.ho_ten}
                    onChange={(event) => { setCustomerForm((current) => ({ ...current, ho_ten: event.target.value })); customerErrors.clearError('ho_ten'); }}
                    isInvalid={!!customerErrors.errors.ho_ten}
                  />
                  <Form.Control.Feedback type="invalid">{customerErrors.errors.ho_ten}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Số điện thoại</Form.Label>
                  <Form.Control
                    value={customerForm.so_dien_thoai}
                    inputMode="tel"
                    placeholder="0901234567 hoặc +84901234567"
                    onChange={(event) => { setCustomerForm((current) => ({ ...current, so_dien_thoai: event.target.value })); customerErrors.clearError('so_dien_thoai'); setDupCandidates(null); }}
                    isInvalid={!!customerErrors.errors.so_dien_thoai}
                  />
                  <Form.Control.Feedback type="invalid">{customerErrors.errors.so_dien_thoai}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    value={customerForm.email}
                    onChange={(event) => { setCustomerForm((current) => ({ ...current, email: event.target.value })); customerErrors.clearError('email'); }}
                    isInvalid={!!customerErrors.errors.email}
                  />
                  <Form.Control.Feedback type="invalid">{customerErrors.errors.email}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group>
                  <Form.Label>Ghi chú</Form.Label>
                  <Form.Control
                    value={customerForm.ghi_chu}
                    onChange={(event) => setCustomerForm((current) => ({ ...current, ghi_chu: event.target.value }))}
                  />
                </Form.Group>
              </div>
              {dupCandidates && dupCandidates.length > 0 ? (
                <Alert variant="warning" className="mt-3 mb-0">
                  <div className="fw-semibold mb-2">Số điện thoại này đã có {dupCandidates.length} khách. Chọn khách sẵn có để tránh tạo trùng:</div>
                  <ListGroup className="selection-list mb-2">
                    {dupCandidates.map((customer) => (
                      <ListGroup.Item key={customer.id} action onClick={() => selectCustomer(customer)}>
                        <div className="fw-semibold">{customer.ho_ten}</div>
                        <div className="small">{customer.so_dien_thoai}</div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                  <Button size="sm" variant="outline-danger" onClick={forceCreateCustomer} disabled={createCustomerMutation.isPending}>
                    Vẫn tạo khách mới
                  </Button>
                </Alert>
              ) : null}
              {createCustomerMutation.error ? <Alert variant="danger" className="mt-3">{createCustomerMutation.error.message}</Alert> : null}
              <Button
                type="submit"
                className="mt-3 button-nowrap"
                disabled={createCustomerMutation.isPending || dupCheckMutation.isPending}
              >
                <UserPlus size={17} aria-hidden="true" />
                Thêm khách
              </Button>
            </Form>
          </section>
        </div>
      ) : null}

      {step === 1 ? (
        <>
          {cardTypesQuery.isLoading ? <LoadingState /> : null}
          {cardTypesQuery.error ? <ErrorState error={cardTypesQuery.error} /> : null}
          {!cardTypesQuery.isLoading && !cardTypesQuery.error ? (
            <Row className="g-3 align-items-start">
              <Col lg={7}>
                <section className="app-panel">
                  <h2>Chọn loại thẻ</h2>
                  {cardTypes.length > 0 ? (
                    <div className="card-type-selector">
                      {cardTypes.map((cardType) => {
                        const isSelected = orderForm.loai_the_id === cardType.id;
                        const currentPrice = Number(cardType.gia_moi_ban_hien_hanh || 0) + Number(cardType.phi_xu_ly_hien_hanh || 0);
                        const displayedPrice = isOnlineFileDelivery ? onlineFilePrice : currentPrice;
                        return (
                          <button
                            type="button"
                            key={cardType.id}
                            className={`card-type-option${isSelected ? ' is-selected' : ''}`}
                            onClick={() => { setOrderForm((current) => ({ ...current, loai_the_id: cardType.id })); setStepError(''); }}
                            aria-pressed={isSelected}
                          >
                            <span className="card-type-option-check" aria-hidden="true">{isSelected ? <Check size={15} /> : null}</span>
                            <span className="card-type-option-copy">
                              <strong>{cardType.ten}</strong>
                              <span>{cardType.ma_viet_tat}</span>
                              <span className="card-type-option-meta">
                                {cardType.rong_mm} x {cardType.cao_mm} mm
                                <span aria-hidden="true">·</span>
                                <span className="card-type-option-color">
                                  <i style={{ backgroundColor: cardType.mau_nen }} aria-hidden="true" />
                                  {cardType.mau_nen}
                                </span>
                              </span>
                            </span>
                            <span className="card-type-option-price">
                              <small>{isOnlineFileDelivery ? 'Giá file trực tuyến' : 'Giá hiện hành'}</small>
                              <strong>{isOnlineFileDelivery && !hasOnlineFilePrice ? 'Chưa cấu hình' : formatCurrency(displayedPrice)}</strong>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : <EmptyState title="Chưa có loại thẻ" description="Admin cần tạo loại thẻ trước khi staff tạo đơn." />}
                </section>
              </Col>
              <Col lg={5}>
                <section className="app-panel">
                  <h2>Thông tin nhận ảnh</h2>
                  {selectedCardType ? (
                    <div className="summary-box mb-3">
                      <span>Loại thẻ đã chọn</span>
                      <strong>{selectedCardType.ten}</strong>
                      <small>{selectedCardType.rong_mm} x {selectedCardType.cao_mm} mm · Nền {selectedCardType.mau_nen}{isOnlineFileDelivery ? ' · Nhận file trực tuyến' : ''}</small>
                    </div>
                  ) : <Alert variant="light" className="mb-3">Chọn một loại thẻ ở cột bên trái để tiếp tục.</Alert>}

                  <div className="d-grid gap-3">
                    <Form.Group>
                      <Form.Label>Hình thức nhận ảnh</Form.Label>
                      <Form.Select
                        value={orderForm.hinh_thuc_giao}
                        onChange={(event) => { setOrderForm((current) => ({ ...current, hinh_thuc_giao: event.target.value })); setStepError(''); }}
                      >
                        <option value="lay_file_truc_tuyen">Chỉ lấy file trực tuyến</option>
                        <option value="lay_hinh_ngay">Lấy hình ngay</option>
                        <option value="hen_lay_hinh">Hẹn lấy hình</option>
                      </Form.Select>
                    </Form.Group>
                    {!isOnlineFileDelivery ? (
                      <Form.Group>
                        <Form.Label>Số lượng</Form.Label>
                        <Form.Control
                          type="number"
                          min="4"
                          value={orderForm.so_luong}
                          onChange={(event) => { setOrderForm((current) => ({ ...current, so_luong: event.target.value })); setStepError(''); }}
                          isInvalid={Number(orderForm.so_luong) < 4}
                        />
                        <Form.Text muted>Tối thiểu 4 tấm/đơn.</Form.Text>
                      </Form.Group>
                    ) : null}
                    {orderForm.hinh_thuc_giao === 'hen_lay_hinh' ? (
                      <Row className="g-3">
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Ngày hẹn lấy</Form.Label>
                            <Form.Control
                              type="date"
                              value={orderForm.ngay_hen_lay}
                              onChange={(event) => { setOrderForm((current) => ({ ...current, ngay_hen_lay: event.target.value })); setStepError(''); }}
                            />
                          </Form.Group>
                        </Col>
                        <Col sm={6}>
                          <Form.Group>
                            <Form.Label>Khung giờ lấy</Form.Label>
                            <Form.Select
                              value={orderForm.khung_gio_lay}
                              onChange={(event) => { setOrderForm((current) => ({ ...current, khung_gio_lay: event.target.value })); setStepError(''); }}
                              disabled={!orderForm.ngay_hen_lay}
                            >
                              <option value="">Chọn khung giờ</option>
                              {TIME_SLOTS.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                            </Form.Select>
                          </Form.Group>
                        </Col>
                      </Row>
                    ) : null}
                    <Form.Group>
                      <Form.Label>Ghi chú đơn</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={orderForm.ghi_chu}
                        onChange={(event) => setOrderForm((current) => ({ ...current, ghi_chu: event.target.value }))}
                      />
                    </Form.Group>
                  </div>

                  <div className="summary-box mt-3">
                    <span>{isOnlineFileDelivery ? 'Giá file trực tuyến' : 'Giá tạm tính'}</span>
                    <strong>{isOnlineFileDelivery
                      ? (hasOnlineFilePrice ? formatCurrency(onlineFilePrice) : 'Chưa cấu hình')
                      : (selectedCardType ? formatCurrency(estimatedTotal) : 'Chọn loại thẻ')}</strong>
                    <small>{isOnlineFileDelivery
                      ? 'Giá trọn gói mỗi đơn, không tính theo số lượng.'
                      : (selectedCardType ? `${orderForm.so_luong} tấm` : 'Giá sẽ hiện sau khi chọn loại thẻ.')}</small>
                  </div>
                  {isOnlineFileDelivery && !hasOnlineFilePrice ? <Alert variant="warning" className="mt-3 mb-0">Admin cần cấu hình giá file trực tuyến trước khi tạo đơn.</Alert> : null}
                  {stepError ? <Alert variant="danger" className="mt-3 mb-0">{stepError}</Alert> : null}
                  <div className="panel-actions">
                    <Button variant="outline-secondary" onClick={() => setStep(0)}>Quay lại</Button>
                    <Button onClick={goToConfirm} disabled={cardTypes.length === 0 || (isOnlineFileDelivery && !hasOnlineFilePrice)}>Tiếp tục</Button>
                  </div>
                </section>
              </Col>
            </Row>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <section className="app-panel">
          <h2>Xác nhận đơn</h2>
          <Row className="g-3">
            <Col md={6}>
              <div className="summary-box">
                <span>Khách hàng</span>
                <strong>{selectedCustomer?.ho_ten}</strong>
                <small>{selectedCustomer?.so_dien_thoai}</small>
              </div>
            </Col>
            <Col md={6}>
              <div className="summary-box">
                <span>Loại thẻ</span>
                <strong>{selectedCardType?.ten}</strong>
                <small>{selectedCardType?.rong_mm} x {selectedCardType?.cao_mm} mm</small>
              </div>
            </Col>
            {!isOnlineFileDelivery ? (
              <Col md={4}>
                <div className="summary-box">
                  <span>Số lượng</span>
                  <strong>{orderForm.so_luong}</strong>
                </div>
              </Col>
            ) : null}
            <Col md={isOnlineFileDelivery ? 6 : 4}>
              <div className="summary-box">
                <span>Ngày hẹn</span>
                <strong>{orderForm.ngay_hen_lay || '-'}</strong>
              </div>
            </Col>
            <Col md={isOnlineFileDelivery ? 6 : 4}>
              <div className="summary-box">
                <span>{isOnlineFileDelivery ? 'Giá file trực tuyến' : 'Giá tạm tính'}</span>
                <strong>{formatCurrency(estimatedTotal)}</strong>
                {isOnlineFileDelivery ? <small>Giá trọn gói mỗi đơn.</small> : null}
              </div>
            </Col>
          </Row>
          {createOrderMutation.error ? <Alert variant="danger" className="mt-3">{createOrderMutation.error.message}</Alert> : null}
          <div className="panel-actions">
            <Button variant="outline-secondary" onClick={() => setStep(1)}>Quay lại</Button>
            <Button onClick={submitOrder} disabled={createOrderMutation.isPending || !selectedCustomer || !selectedCardType || (isOnlineFileDelivery && !hasOnlineFilePrice)}>
              {createOrderMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
