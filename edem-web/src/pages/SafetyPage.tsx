export function SafetyPage() {
  return (
    <>
      <section className="card">
        <h2 className="page-title">Безопасность в ЭДЕМ</h2>
        <p className="page-sub">
          Короткие правила, чтобы знакомства в зале оставались комфортными и безопасными.
        </p>
        <div className="grid">
          <div className="list-item">
            <strong>Первая встреча</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Назначай встречу внутри фитнес-клуба или в другом публичном месте.
            </span>
          </div>
          <div className="list-item">
            <strong>Личные данные</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Не отправляй документы, коды из SMS и данные банковских карт.
            </span>
          </div>
          <div className="list-item">
            <strong>Дискомфорт в общении</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Используй блокировку и жалобу. Мы отдельно проверяем повторяющиеся нарушения.
            </span>
          </div>
          <div className="list-item">
            <strong>Подозрительный профиль</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Нажми «Пожаловаться + скрыть» в ленте — профиль пропадет сразу.
            </span>
          </div>
        </div>
      </section>

      <section className="card" style={{ marginTop: 14 }}>
        <h2 className="page-title page-title--sm">Сбор и хранение информации</h2>
        <p className="page-sub" style={{ marginBottom: 12 }}>
          Ниже — сжатое объяснение для пользователей. Исчерпывающие формулировки, реквизиты оператора и
          порядок обращений по персональным данным содержатся в{' '}
          <strong>политике конфиденциальности</strong>, которую оператор сервиса публикует отдельно (в том
          числе на сайте проекта).
        </p>
        <div className="grid">
          <div className="list-item">
            <strong>Что мы обрабатываем</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Данные профиля (имя, возраст, пол, город, зал, описание, фото), контакты и учётные данные для
              входа (телефон или email), переписка внутри сервиса, действия в приложении (лайки, матчи,
              жалобы, блокировки). Для работы и защиты сервиса фиксируются технические сведения: например,
              IP-адрес и служебные журналы запросов.
            </span>
          </div>
          <div className="list-item">
            <strong>Зачем это нужно</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Чтобы ты мог пользоваться ЭДЕМ: показывать анкету, подбирать людей в зале, переписываться,
              обращаться в поддержку. Также — чтобы модерировать контент, предотвращать злоупотребления и
              обеспечивать безопасность. Отдельные рассылки или маркетинг — только если на это есть отдельное
              согласие, когда оно требуется по закону.
            </span>
          </div>
          <div className="list-item">
            <strong>Хранение и защита</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Данные хранятся на защищённой инфраструктуре не дольше, чем нужно для целей сервиса и сроков,
              установленных законом. Доступ ограничен; пароли не хранятся в открытом виде. Мы не продаём
              персональные данные. Передача возможна надёжным подрядчикам (хостинг, инфраструктура) по
              договору о конфиденциальности и в случаях, прямо предусмотренных законодательством РФ.
            </span>
          </div>
          <div className="list-item">
            <strong>Твои права</strong>
            <span className="chat-list-preview" style={{ whiteSpace: "normal" }}>
              Ты можешь запросить информацию об обработке, уточнить или удалить данные там, где это
              допускается законом, отозвать согласие — порядок указан в полной политике и через контакты
              оператора. Удаление аккаунта ограничивает использование сервиса; часть сведений может
              сохраняться, если закон обязывает это сделать.
            </span>
          </div>
        </div>
      </section>
    </>
  );
}
