--
-- PostgreSQL database dump
--

\restrict XIpWYmo4t0ELtFhahPZYsBi5D2DwBWbGqpHcjude7WmLJH9gZeoxzWuopPk5zDS

-- Dumped from database version 18.3
-- Dumped by pg_dump version 18.3

-- Started on 2026-05-05 15:08:19

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 230 (class 1259 OID 16466)
-- Name: availability; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.availability (
    id integer NOT NULL,
    user_id integer,
    day_of_week character varying(20) NOT NULL,
    available_minutes integer NOT NULL
);


ALTER TABLE public.availability OWNER TO postgres;

--
-- TOC entry 229 (class 1259 OID 16465)
-- Name: availability_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.availability_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.availability_id_seq OWNER TO postgres;

--
-- TOC entry 5025 (class 0 OID 0)
-- Dependencies: 229
-- Name: availability_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.availability_id_seq OWNED BY public.availability.id;


--
-- TOC entry 222 (class 1259 OID 16400)
-- Name: goals; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.goals (
    id integer NOT NULL,
    user_id integer,
    title character varying(255) NOT NULL,
    target_date date NOT NULL,
    status character varying(50) DEFAULT 'active'::character varying
);


ALTER TABLE public.goals OWNER TO postgres;

--
-- TOC entry 221 (class 1259 OID 16399)
-- Name: goals_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.goals_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.goals_id_seq OWNER TO postgres;

--
-- TOC entry 5026 (class 0 OID 0)
-- Dependencies: 221
-- Name: goals_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.goals_id_seq OWNED BY public.goals.id;


--
-- TOC entry 224 (class 1259 OID 16416)
-- Name: milestones; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.milestones (
    id integer NOT NULL,
    goal_id integer,
    title character varying(255) NOT NULL,
    sequence_order integer NOT NULL
);


ALTER TABLE public.milestones OWNER TO postgres;

--
-- TOC entry 223 (class 1259 OID 16415)
-- Name: milestones_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.milestones_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.milestones_id_seq OWNER TO postgres;

--
-- TOC entry 5027 (class 0 OID 0)
-- Dependencies: 223
-- Name: milestones_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.milestones_id_seq OWNED BY public.milestones.id;


--
-- TOC entry 228 (class 1259 OID 16447)
-- Name: tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.tasks (
    id integer NOT NULL,
    topic_id integer,
    scheduled_date date NOT NULL,
    task_text text NOT NULL,
    estimated_minutes integer NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying
);


ALTER TABLE public.tasks OWNER TO postgres;

--
-- TOC entry 227 (class 1259 OID 16446)
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO postgres;

--
-- TOC entry 5028 (class 0 OID 0)
-- Dependencies: 227
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- TOC entry 226 (class 1259 OID 16431)
-- Name: topics; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.topics (
    id integer NOT NULL,
    milestone_id integer,
    title character varying(255) NOT NULL,
    estimated_minutes integer NOT NULL,
    sequence_order integer NOT NULL
);


ALTER TABLE public.topics OWNER TO postgres;

--
-- TOC entry 225 (class 1259 OID 16430)
-- Name: topics_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.topics_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.topics_id_seq OWNER TO postgres;

--
-- TOC entry 5029 (class 0 OID 0)
-- Dependencies: 225
-- Name: topics_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.topics_id_seq OWNED BY public.topics.id;


--
-- TOC entry 220 (class 1259 OID 16390)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    id integer NOT NULL,
    name character varying(100),
    email character varying(150)
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 219 (class 1259 OID 16389)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO postgres;

--
-- TOC entry 5030 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4841 (class 2604 OID 16469)
-- Name: availability id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability ALTER COLUMN id SET DEFAULT nextval('public.availability_id_seq'::regclass);


--
-- TOC entry 4835 (class 2604 OID 16403)
-- Name: goals id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goals ALTER COLUMN id SET DEFAULT nextval('public.goals_id_seq'::regclass);


--
-- TOC entry 4837 (class 2604 OID 16419)
-- Name: milestones id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones ALTER COLUMN id SET DEFAULT nextval('public.milestones_id_seq'::regclass);


--
-- TOC entry 4839 (class 2604 OID 16450)
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- TOC entry 4838 (class 2604 OID 16434)
-- Name: topics id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics ALTER COLUMN id SET DEFAULT nextval('public.topics_id_seq'::regclass);


--
-- TOC entry 4834 (class 2604 OID 16393)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 5019 (class 0 OID 16466)
-- Dependencies: 230
-- Data for Name: availability; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.availability (id, user_id, day_of_week, available_minutes) FROM stdin;
1	1	Monday	60
2	1	Wednesday	60
3	1	Friday	90
\.


--
-- TOC entry 5011 (class 0 OID 16400)
-- Dependencies: 222
-- Data for Name: goals; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.goals (id, user_id, title, target_date, status) FROM stdin;
1	1	Learn Python for Data Science	2026-06-30	active
\.


--
-- TOC entry 5013 (class 0 OID 16416)
-- Dependencies: 224
-- Data for Name: milestones; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.milestones (id, goal_id, title, sequence_order) FROM stdin;
1	1	Python Basics	1
2	1	Data Structures	2
3	1	Data Analysis Basics	3
\.


--
-- TOC entry 5017 (class 0 OID 16447)
-- Dependencies: 228
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.tasks (id, topic_id, scheduled_date, task_text, estimated_minutes, status) FROM stdin;
19	1	2026-05-04	Study: Variables and data types	60	pending
20	2	2026-05-06	Study: Conditional statements	60	pending
21	3	2026-05-08	Study: Loops	90	pending
25	7	2026-05-18	Study: Introduction to NumPy - Part 1	60	pending
26	7	2026-05-20	Study: Introduction to NumPy - Part 2	30	pending
22	4	2026-05-11	Study: Lists	60	completed
23	5	2026-05-13	Study: Dictionaries	60	skipped
24	6	2026-05-15	Study: Functions	90	completed
27	8	2026-05-20	Study: Introduction to Pandas - Part 1	30	completed
28	8	2026-05-22	Study: Introduction to Pandas - Part 2	90	skipped
\.


--
-- TOC entry 5015 (class 0 OID 16431)
-- Dependencies: 226
-- Data for Name: topics; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.topics (id, milestone_id, title, estimated_minutes, sequence_order) FROM stdin;
1	1	Variables and data types	60	1
2	1	Conditional statements	60	2
3	1	Loops	90	3
4	2	Lists	60	1
5	2	Dictionaries	60	2
6	2	Functions	90	3
7	3	Introduction to NumPy	90	1
8	3	Introduction to Pandas	120	2
\.


--
-- TOC entry 5009 (class 0 OID 16390)
-- Dependencies: 220
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (id, name, email) FROM stdin;
1	Test User	test@example.com
\.


--
-- TOC entry 5031 (class 0 OID 0)
-- Dependencies: 229
-- Name: availability_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.availability_id_seq', 3, true);


--
-- TOC entry 5032 (class 0 OID 0)
-- Dependencies: 221
-- Name: goals_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.goals_id_seq', 1, true);


--
-- TOC entry 5033 (class 0 OID 0)
-- Dependencies: 223
-- Name: milestones_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.milestones_id_seq', 3, true);


--
-- TOC entry 5034 (class 0 OID 0)
-- Dependencies: 227
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.tasks_id_seq', 28, true);


--
-- TOC entry 5035 (class 0 OID 0)
-- Dependencies: 225
-- Name: topics_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.topics_id_seq', 8, true);


--
-- TOC entry 5036 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_id_seq', 1, true);


--
-- TOC entry 4855 (class 2606 OID 16474)
-- Name: availability availability_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_pkey PRIMARY KEY (id);


--
-- TOC entry 4847 (class 2606 OID 16409)
-- Name: goals goals_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_pkey PRIMARY KEY (id);


--
-- TOC entry 4849 (class 2606 OID 16424)
-- Name: milestones milestones_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_pkey PRIMARY KEY (id);


--
-- TOC entry 4853 (class 2606 OID 16459)
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- TOC entry 4851 (class 2606 OID 16440)
-- Name: topics topics_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_pkey PRIMARY KEY (id);


--
-- TOC entry 4843 (class 2606 OID 16398)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 4845 (class 2606 OID 16396)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4860 (class 2606 OID 16475)
-- Name: availability availability_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.availability
    ADD CONSTRAINT availability_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4856 (class 2606 OID 16410)
-- Name: goals goals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.goals
    ADD CONSTRAINT goals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- TOC entry 4857 (class 2606 OID 16425)
-- Name: milestones milestones_goal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.milestones
    ADD CONSTRAINT milestones_goal_id_fkey FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE;


--
-- TOC entry 4859 (class 2606 OID 16460)
-- Name: tasks tasks_topic_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_topic_id_fkey FOREIGN KEY (topic_id) REFERENCES public.topics(id) ON DELETE CASCADE;


--
-- TOC entry 4858 (class 2606 OID 16441)
-- Name: topics topics_milestone_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.topics
    ADD CONSTRAINT topics_milestone_id_fkey FOREIGN KEY (milestone_id) REFERENCES public.milestones(id) ON DELETE CASCADE;


-- Completed on 2026-05-05 15:08:20

--
-- PostgreSQL database dump complete
--

\unrestrict XIpWYmo4t0ELtFhahPZYsBi5D2DwBWbGqpHcjude7WmLJH9gZeoxzWuopPk5zDS

