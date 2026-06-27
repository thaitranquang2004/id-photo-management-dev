import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, Search, UserPlus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Alert, Button, Col, Form, InputGroup, ListGroup, Row, Table } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { listCardTypes } from '../../api/admin';
import { createCustomer, searchCustomersByPhone } from '../../api/customers';
import { createOrder } from '../../api/orders';
import EmptyState from '../../components/feedback/EmptyState.jsx';
import ErrorState from '../../components/feedback/ErrorState.jsx';
import LoadingState from '../../components/feedback/LoadingState.jsx';
import { formatCurrency } from '../../utils/format';
import { useFormErrors } from '../../hooks/useFormErrors.js';

const steps = ['Khách hàng', 'Thông tin đơn', 'Xác nhận'];

export default function NewOrderPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [so_dien_thoai, setPhone] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerForm, setCustomerForm] = useState({ ho_ten: '', so_dien_thoai: '', email: '', ghi_chu: '' });
  const [orderForm, setOrderForm] = useState({
    loai_the_id: '',
    so_luong: 4,
    ngay_hen_lay: '',
    ghi_chu: '',
    hinh_thuc_giao: 'pickup'
  });
  const searchErrors = useFormErrors();
  const customerErrors = useFormErrors();
  const [stepError, setStepError] = useState('');

  const cardTypesQuery = useQuery({
    queryKey: ['card-types'],
    queryFn: listCardTypes
  });

  const searchMutation = useMutation({
    mutationFn: searchCustomersByPhone,
    onSuccess: (result) => {
      setCustomers(result);
      if (result.length === 1) setSelectedCustomer(result[0]);
    }
  });

  const createCustomerMutation = useMutation({
    mutationFn: createCustomer,
    onSuccess: ({ customer }) => {
      setSelectedCustomer(customer);
      setCustomers([customer]);
      setStep(1);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: createOrder,
    onSuccess: ({ order }) => navigate(`/staff/orders/${order.id}`)
  });

  const cardTypes = cardTypesQuery.data?.card_types || [];
  const selectedCardType = cardTypes.find((cardType) => cardType.id === orderForm.loai_the_id);
  const estimatedTotal = useMemo(() => {
    if (!selectedCardType) return 0;
    return Number(selectedCardType.gia_moi_ban_hien_hanh || 0) * Number(orderForm.so_luong || 0)
      + Number(selectedCardType.phi_xu_ly_hien_hanh || 0);
  }, [orderForm.so_luong, selectedCardType]);

  function handleSearch(event) {
    event.preventDefault();
    if (!searchErrors.validate({ so_dien_thoai }, { so_dien_thoai: 'Vui lòng nhập số điện thoại để tìm' })) return;
    const value = so_dien_thoai.trim();
    setCustomerForm((current) => ({ ...current, so_dien_thoai: value }));
    searchMutation.mutate(value);
  }

  function submitCustomer(event) {
    event.preventDefault();
    if (!customerErrors.validate(customerForm, { ho_ten: 'Vui lòng nhập họ tên', so_dien_thoai: 'Vui lòng nhập số điện thoại' })) return;
    createCustomerMutation.mutate(customerForm);
  }

  function goToConfirm() {
    if (!selectedCardType) {
      setStepError('Vui lòng chọn một loại thẻ.');
      return;
    }
    if (Number(orderForm.so_luong) < 4) {
      setStepError('Số lượng tối thiểu là 4 tấm/đơn.');
      return;
    }
    setStepError('');
    setStep(2);
  }

  function submitOrder() {
    if (!selectedCustomer || !selectedCardType) return;
    createOrderMutation.mutate({
      khach_hang_id: selectedCustomer.id,
      loai_the_id: selectedCardType.id,
      so_luong: Number(orderForm.so_luong),
      ngay_hen_lay: orderForm.ngay_hen_lay || undefined,
      ghi_chu: orderForm.ghi_chu || undefined,
      hinh_thuc_giao: orderForm.hinh_thuc_giao
    });
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h1>Tạo đơn mới</h1>
          <p>Wizard 3 bước: tìm khách, chọn loại thẻ, xác nhận giá tạm tính.</p>
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
        <Row className="g-3">
          <Col lg={6}>
            <section className="app-panel">
              <h2>Tìm khách bằng SĐT</h2>
              <Form onSubmit={handleSearch}>
                <InputGroup className="mb-1" hasValidation>
                  <Form.Control
                    value={so_dien_thoai}
                    onChange={(event) => { setPhone(event.target.value); searchErrors.clearError('so_dien_thoai'); }}
                    placeholder="Nhập số điện thoại"
                    isInvalid={!!searchErrors.errors.so_dien_thoai}
                  />
                  <Button type="submit" disabled={searchMutation.isPending}>
                    <Search size={17} aria-hidden="true" />
                    Tìm
                  </Button>
                  <Form.Control.Feedback type="invalid">{searchErrors.errors.so_dien_thoai}</Form.Control.Feedback>
                </InputGroup>
                <div className="mb-3" />
              </Form>
              {searchMutation.isPending ? <LoadingState label="Đang tìm khách..." /> : null}
              {searchMutation.error ? (
                <Alert variant="warning" className="mb-0">Không tìm được khách. Vui lòng kiểm tra lại số điện thoại hoặc tạo khách mới.</Alert>
              ) : null}
              {customers.length > 0 ? (
                <ListGroup className="selection-list">
                  {customers.map((customer) => (
                    <ListGroup.Item
                      key={customer.id}
                      action
                      active={selectedCustomer?.id === customer.id}
                      onClick={() => setSelectedCustomer(customer)}
                    >
                      <div className="fw-semibold">{customer.ho_ten}</div>
                      <div className="small">{customer.so_dien_thoai}</div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              ) : !searchMutation.isIdle && !searchMutation.isPending ? (
                <EmptyState title="Chưa có khách" description="Tạo khách mới ở form bên cạnh nếu số điện thoại chưa tồn tại." />
              ) : null}
              <div className="mt-3 text-end">
                <Button onClick={() => setStep(1)} disabled={!selectedCustomer}>
                  Tiếp tục
                </Button>
              </div>
            </section>
          </Col>
          <Col lg={6}>
            <section className="app-panel">
              <h2>Thêm khách mới</h2>
              <Form onSubmit={submitCustomer}>
                <Row className="g-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Họ tên</Form.Label>
                      <Form.Control
                        value={customerForm.ho_ten}
                        onChange={(event) => { setCustomerForm((current) => ({ ...current, ho_ten: event.target.value })); customerErrors.clearError('ho_ten'); }}
                        isInvalid={!!customerErrors.errors.ho_ten}
                      />
                      <Form.Control.Feedback type="invalid">{customerErrors.errors.ho_ten}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Số điện thoại</Form.Label>
                      <Form.Control
                        value={customerForm.so_dien_thoai}
                        onChange={(event) => { setCustomerForm((current) => ({ ...current, so_dien_thoai: event.target.value })); customerErrors.clearError('so_dien_thoai'); }}
                        isInvalid={!!customerErrors.errors.so_dien_thoai}
                      />
                      <Form.Control.Feedback type="invalid">{customerErrors.errors.so_dien_thoai}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Email</Form.Label>
                      <Form.Control
                        type="email"
                        value={customerForm.email}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label>Ghi chú</Form.Label>
                      <Form.Control
                        value={customerForm.ghi_chu}
                        onChange={(event) => setCustomerForm((current) => ({ ...current, ghi_chu: event.target.value }))}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                {createCustomerMutation.error ? <Alert variant="danger" className="mt-3">{createCustomerMutation.error.message}</Alert> : null}
                <Button
                  type="submit"
                  className="mt-3 button-nowrap"
                  disabled={createCustomerMutation.isPending}
                >
                  <UserPlus size={17} aria-hidden="true" />
                  Thêm khách
                </Button>
              </Form>
            </section>
          </Col>
        </Row>
      ) : null}

      {step === 1 ? (
        <section className="app-panel">
          <h2>Chọn loại thẻ và thông tin nhận ảnh</h2>
          {cardTypesQuery.isLoading ? <LoadingState /> : null}
          {cardTypesQuery.error ? <ErrorState error={cardTypesQuery.error} /> : null}
          {!cardTypesQuery.isLoading && !cardTypesQuery.error ? (
            <>
              <div className="table-responsive">
                <Table hover className="align-middle data-table">
                  <thead>
                    <tr>
                      <th>Chọn</th>
                      <th>Loại thẻ</th>
                      <th>Kích thước</th>
                      <th>Nền</th>
                      <th>Giá hiện hành</th>
                      <th>Yêu cầu</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cardTypes.map((cardType) => (
                      <tr key={cardType.id} className={orderForm.loai_the_id === cardType.id ? 'selected-row' : ''}>
                        <td>
                          <Form.Check
                            type="radio"
                            name="card-type"
                            checked={orderForm.loai_the_id === cardType.id}
                            onChange={() => { setOrderForm((current) => ({ ...current, loai_the_id: cardType.id })); setStepError(''); }}
                            aria-label={`Chọn ${cardType.ten}`}
                          />
                        </td>
                        <td>
                          <div className="fw-semibold">{cardType.ten}</div>
                          <div className="text-muted small">{cardType.ma_viet_tat}</div>
                        </td>
                        <td>{cardType.rong_mm} x {cardType.cao_mm} mm</td>
                        <td>
                          <span className="color-swatch" style={{ backgroundColor: cardType.mau_nen }} />
                          {cardType.mau_nen}
                        </td>
                        <td>{formatCurrency(Number(cardType.gia_moi_ban_hien_hanh || 0) + Number(cardType.phi_xu_ly_hien_hanh || 0))}</td>
                        <td className="requirements-cell">{JSON.stringify(cardType.yeu_cau || {})}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
              {cardTypes.length === 0 ? <EmptyState title="Chưa có loại thẻ" description="Admin cần tạo loại thẻ trước khi staff tạo đơn." /> : null}
              <Row className="g-3 mt-1">
                <Col md={3}>
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
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Hình thức giao</Form.Label>
                    <Form.Select
                      value={orderForm.hinh_thuc_giao}
                      onChange={(event) => setOrderForm((current) => ({ ...current, hinh_thuc_giao: event.target.value }))}
                    >
                      <option value="pickup">Lấy tại quầy</option>
                      <option value="online">Khách tải online</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Ngày hẹn lấy</Form.Label>
                    <Form.Control
                      type="date"
                      value={orderForm.ngay_hen_lay}
                      onChange={(event) => setOrderForm((current) => ({ ...current, ngay_hen_lay: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
                <Col md={3}>
                  <Form.Group>
                    <Form.Label>Ghi chú đơn</Form.Label>
                    <Form.Control
                      value={orderForm.ghi_chu}
                      onChange={(event) => setOrderForm((current) => ({ ...current, ghi_chu: event.target.value }))}
                    />
                  </Form.Group>
                </Col>
              </Row>
              {stepError ? <Alert variant="danger" className="mt-3 mb-0">{stepError}</Alert> : null}
              <div className="panel-actions">
                <Button variant="outline-secondary" onClick={() => setStep(0)}>Quay lại</Button>
                <Button onClick={goToConfirm} disabled={cardTypes.length === 0}>Tiếp tục</Button>
              </div>
            </>
          ) : null}
        </section>
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
                <strong>{selectedCardType?.name}</strong>
                <small>{selectedCardType?.width_mm} x {selectedCardType?.height_mm} mm</small>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Số lượng</span>
                <strong>{orderForm.so_luong}</strong>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Ngày hẹn</span>
                <strong>{orderForm.ngay_hen_lay || '-'}</strong>
              </div>
            </Col>
            <Col md={4}>
              <div className="summary-box">
                <span>Giá tạm tính</span>
                <strong>{formatCurrency(estimatedTotal)}</strong>
              </div>
            </Col>
          </Row>
          {createOrderMutation.error ? <Alert variant="danger" className="mt-3">{createOrderMutation.error.message}</Alert> : null}
          <div className="panel-actions">
            <Button variant="outline-secondary" onClick={() => setStep(1)}>Quay lại</Button>
            <Button onClick={submitOrder} disabled={createOrderMutation.isPending || !selectedCustomer || !selectedCardType}>
              {createOrderMutation.isPending ? 'Đang tạo đơn...' : 'Tạo đơn'}
            </Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
